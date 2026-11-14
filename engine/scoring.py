def calculate_weighted_score(criteria_scores, weights):
    """
    Calculate a weighted score from validated criteria.

    criteria_scores: dictionary of criterion scores.
    weights: dictionary of criterion weights.

    Missing criteria are excluded, not treated as zero.
    """

    weighted_total = 0
    total_weight = 0

    for criterion, weight in weights.items():
        score = criteria_scores.get(criterion)

        if score is None:
            continue

        if not isinstance(score, (int, float)):
            continue

        if not isinstance(weight, (int, float)) or weight <= 0:
            continue

        weighted_total += score * weight
        total_weight += weight

    if total_weight == 0:
        return None

    return round(weighted_total / total_weight, 2)


# ---------------------------------------------------------------------------
# Crop and rotation suitability scoring (heuristic, transparent, standard library only)
# ---------------------------------------------------------------------------
from engine import rules as R  # noqa: E402
from engine.knowledge_base import KnowledgeBase  # noqa: E402


def _number(value):
    if value is None or isinstance(value, bool):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def resolve_weights(weights, priorities):
    """Return (requested, normalised, source, warnings).

    weights: partial override of the defaults (earlier six-criterion names are mapped to the five priorities).
    priorities: the farmer's own selection; unspecified priorities then count as 0.
    Invalid or negative entries are ignored with a warning. All-zero input falls back to the defaults.
    """
    warnings: list[str] = []
    requested = dict(R.DEFAULT_REQUESTED)
    source = "pilot_default"

    def parse(raw, label):
        out: dict[str, float] = {}
        for key, val in (raw or {}).items():
            name = R.LEGACY_WEIGHT_MAP.get(str(key), str(key))
            num = _number(val)
            if name not in R.CRITERIA:
                warnings.append(f"{label}: unknown key {key!r} ignored")
            elif num is None or num < 0:
                warnings.append(f"{label}: invalid value for {key!r} ignored")
            else:
                out[name] = out.get(name, 0.0) + num   # two legacy keys can map to one priority
        return out

    if weights:
        parsed = parse(weights, "weights")
        if parsed:
            requested.update(parsed); source = "request_weights"
    elif priorities:
        parsed = parse(priorities, "priorities")
        if parsed:
            requested = {k: parsed.get(k, 0.0) for k in R.CRITERIA}; source = "farmer_priorities"
    total = sum(requested.values())
    if total <= 0:
        warnings.append("all weights were zero; defaults used")
        requested = dict(R.DEFAULT_REQUESTED); total = sum(requested.values()); source = "pilot_default"
    normalised = {k: requested[k] / total for k in R.CRITERIA}
    return requested, normalised, source, warnings


def _pick(kb: KnowledgeBase, crop, trait, table, neutral):
    if neutral and not kb.is_supported(crop, trait):
        return R.NEUTRAL
    return table.get(kb.value(crop, trait), R.NEUTRAL)


def n_credit(kb: KnowledgeBase, crop, neutral=False):
    c = kb.crops[crop]
    if "n_credit" not in c:
        return 1.0
    if neutral and not kb.is_supported(crop, "n_credit"):
        return 0.5
    return float(c["n_credit"]["value"])


def crop_scores(kb: KnowledgeBase, crop, exposure, neutral=False, shrink=1.0):
    """Score one crop (0 to 1, higher is better for the farmer). Unknown traits score neutral, never good or bad."""
    t = R.TABLES
    req = _pick(kb, crop, "water_requirement", t["low_is_better"], neutral)
    tol = _pick(kb, crop, "drought_tolerance", t["tolerance"], neutral)
    water = req * 0.5 + tol * 0.5 - R.DRY_SPELL_WEIGHT * exposure * (1 - tol)
    fixing = kb.value(crop, "nitrogen_fixing")
    if fixing == "yes" and not (neutral and not kb.is_supported(crop, "nitrogen_fixing")):
        nitrogen = R.NITROGEN_FIXER_BASE + R.NITROGEN_FIXER_SPAN * n_credit(kb, crop, neutral)
    elif fixing == "no" or fixing == "yes":
        nitrogen = R.NEUTRAL if (neutral and not kb.is_supported(crop, "nutrient_demand")) else t["nutrient_demand"].get(kb.value(crop, "nutrient_demand"), R.NEUTRAL)
    else:
        nitrogen = R.NEUTRAL
    erosion = _pick(kb, crop, "ground_cover_erosion", t["cover"], neutral)
    food = _pick(kb, crop, "household_food_use", t["food"], neutral)
    income = 0.7 * _pick(kb, crop, "market_access", t["market"], neutral) + 0.3 * _pick(kb, crop, "input_cost", t["low_is_better"], neutral)
    labour = _pick(kb, crop, "labour_demand", t["low_is_better"], neutral)
    raw = {"water": water, "nitrogen": nitrogen, "erosion": erosion, "food": food, "income": income, "labour": labour}
    if not kb.locally_confirmed(crop):   # novelty discount: crops not yet confirmed locally move only part of the way from neutral
        raw = {k: R.NEUTRAL + shrink * (v - R.NEUTRAL) for k, v in raw.items()}
    return {k: max(0.0, min(1.0, v)) for k, v in raw.items()}


def sequence_scores(kb: KnowledgeBase, cycle, exposure, neutral=False, shrink=1.0):
    """Average crop scores over the rotation cycle, then apply small documented rotation adjustments."""
    n = len(cycle)
    per = {c: crop_scores(kb, c, exposure, neutral, shrink) for c in dict.fromkeys(cycle)}
    mean = lambda key: sum(per[c][key] for c in cycle) / n
    pairs = [(cycle[i], cycle[(i + 1) % n]) for i in range(n)]
    legume_then_cereal = [a for a, b in pairs if kb.group(a) == "legume" and kb.group(b) == "cereal"]
    repeats = [a for a, b in pairs if a == b]
    nitrogen = mean("nitrogen") + R.LEGUME_THEN_CEREAL_BONUS * sum(n_credit(kb, a, neutral) for a in legume_then_cereal) / n \
        - R.REPEAT_PENALTY_NITROGEN * len(repeats) / n
    income = mean("income") - R.REPEAT_PENALTY_INCOME * len(repeats) / n
    nitrogen, income = max(0.0, min(1.0, nitrogen)), max(0.0, min(1.0, income))
    erosion = mean("erosion")
    scores = {"water": mean("water"), "soil_health": (nitrogen + erosion) / 2, "food": mean("food"), "income": income, "labour": mean("labour")}
    return {
        "criterion_scores": scores,
        "soil_health_components": {"nitrogen": nitrogen, "erosion": erosion},
        "rotation_effects": {"legume_to_cereal_transitions": len(legume_then_cereal), "repeat_transitions": len(repeats), "cycle_length": n},
        "per_crop": per,
    }


def suitability_index(criterion_scores, weights) -> float:
    """Weighted index on a 0-100 scale. Not a probability and not a yield prediction."""
    return sum(criterion_scores[k] * weights[k] for k in R.CRITERIA) * 100


def sensitivity_range(kb: KnowledgeBase, cycle, weights, exposures):
    """Lowest and highest index over: dry-spell exposure at each tested threshold (and none resolved),
    unsourced traits kept or set to neutral, and the novelty discount kept or removed. A robustness check, not a confidence interval."""
    values = []
    for e in exposures:
        for neutral in (False, True):
            for shrink in R.SENSITIVITY_SHRINKS:
                values.append(suitability_index(sequence_scores(kb, cycle, e, neutral, shrink)["criterion_scores"], weights))
    return min(values), max(values)

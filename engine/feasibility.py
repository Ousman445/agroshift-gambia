"""Hard feasibility checks (Stage 1). A violated limit means not recommended; open questions mean conditional.

Missing information is never read as "available" or "unavailable":
  - seed for a crop that is not confirmed locally and not reported either way is 'unknown' -> conditional
  - unknown labour or budget is a recorded gap, not a failure
"""
from __future__ import annotations

from engine import rules as R
from engine.knowledge_base import KnowledgeBase


def _lower_set(values) -> set[str]:
    return {str(v).strip().lower() for v in (values or [])}


def _word(value) -> str | None:
    if value is None:
        return None
    return str(value).strip().lower()


def seed_state(crop: str, farmer: dict, constraints: dict, kb: KnowledgeBase) -> str:
    """Return 'available', 'limited', 'unavailable' or 'unknown'. Explicit reports beat the knowledge base."""
    seed_access = constraints.get("seed_access") if isinstance(constraints.get("seed_access"), dict) else {}
    word = _word(seed_access.get(crop))
    if crop in _lower_set(farmer.get("unavailable_crops")) or word in R.UNAVAILABLE_WORDS:
        return "unavailable"
    if word in R.LIMITED_WORDS:
        return "limited"
    if crop in _lower_set(farmer.get("available_crops")) or crop in _lower_set(farmer.get("seed_available")) or word in R.AVAILABLE_WORDS:
        return "available"
    if kb.locally_confirmed(crop):
        return "available"   # grown by Manduar farmers (own saved seed or market, farmer report); override with an explicit report
    return "unknown"


def choose_cycle(slots: list[list[str]], farmer: dict, constraints: dict, kb: KnowledgeBase) -> list[str]:
    """Pick one crop per slot: prefer available, then unknown/limited, then unavailable (kept so it is reported)."""
    rank = {"available": 0, "limited": 1, "unknown": 1, "unavailable": 2}
    cycle = []
    for alternatives in slots:
        usable = [c for c in alternatives if kb.has_crop(c)]
        cycle.append(sorted(usable, key=lambda c: (rank[seed_state(c, farmer, constraints, kb)], usable.index(c)))[0])
    return cycle


def _mean_labour_score(cycle, kb) -> float:
    vals = [R.TABLES["low_is_better"].get(kb.value(c, "labour_demand"), R.NEUTRAL) for c in cycle]
    return sum(vals) / len(vals)


def assess(cycle: list[str], strategy: dict, farmer: dict, constraints: dict, kb: KnowledgeBase) -> dict:
    failures, conditions, unavailable, unknown, would, input_gaps = [], [], [], [], [], []
    for crop in dict.fromkeys(cycle):
        state = seed_state(crop, farmer, constraints, kb)
        if state == "unavailable":
            unavailable.append(crop); would.append(f"a reliable seed source for {crop} is found")
        elif state in ("unknown", "limited"):
            unknown.append(crop); would.append(f"seed access for {crop} is confirmed with the farmer or an extension officer")
    if unavailable:
        failures.append("Seed or crop unavailable: " + ", ".join(unavailable))

    budget_flag = constraints.get("budget_available")
    cash = _word(farmer.get("cash_available") or farmer.get("budget_level") or constraints.get("budget_level"))
    no_money = budget_flag is False or cash == "none"
    low_money = cash == "low"
    high_input = [c for c in dict.fromkeys(cycle) if kb.value(c, "input_cost") == "high"]
    mid_input = [c for c in dict.fromkeys(cycle) if kb.value(c, "input_cost") == "medium"]
    if no_money and high_input:
        failures.append("Budget is reported as unavailable but the sequence needs costly inputs: " + ", ".join(high_input))
        would.append("money for inputs such as fertiliser is available")
    elif no_money and mid_input:
        conditions.append("Seed or input purchases need a budget, which the farmer reports as unavailable: " + ", ".join(mid_input))
    elif low_money and high_input:
        conditions.append("Budget is low and the sequence needs costly inputs: " + ", ".join(high_input))
    if budget_flag is None and cash is None:
        input_gaps.append("budget not recorded")

    labour_flag = constraints.get("labour_available")
    labour = _word(farmer.get("labour"))
    heavy = _mean_labour_score(cycle, kb) < 0.4
    if labour_flag is False and heavy:
        failures.append("Labour is reported as insufficient and the sequence has high labour demand")
        would.append("extra labour can be hired or shared")
    elif labour_flag is False or (labour == "family_only" and heavy):
        conditions.append("Labour is limited; check peak-season labour for weeding, harvest and bird-scaring")
    if labour_flag is None and labour is None:
        input_gaps.append("labour availability not recorded")

    water_word = constraints.get("dry_season_water", farmer.get("dry_season_water_access"))
    no_dry_water = water_word in (False, "none", "unavailable") or _word(water_word) in ("none", "unavailable", "false")
    if strategy.get("cover_crop"):
        if no_dry_water:
            failures.append("Dry-season cover crop is infeasible because reliable dry-season water is unavailable")
        if (constraints.get("post_harvest_grazing") is True or farmer.get("dry_season_grazing") is True) and not constraints.get("grazing_management"):
            failures.append("Post-harvest grazing is reported but no grazing-management arrangement is supplied")

    if failures:
        status = "not_recommended"
    elif unknown or conditions:
        status = "conditional_candidate"
    else:
        status = "feasible_candidate"
    return {"status": status, "failures": failures, "conditions": conditions, "unavailable_crops": unavailable,
            "unconfirmed_candidate_crops": unknown, "would_become_feasible_if": would, "input_gaps": input_gaps}

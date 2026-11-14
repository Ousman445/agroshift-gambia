"""Orchestrates the AgroShift recommendation engine: input checks -> feasibility -> scoring -> explanation.

Standard library only. Output keeps the existing API contract (field_id, strategies A/B/C, weights, constraints,
data_quality, assumptions, disclaimer) and adds: reference_rotation, suggestion, climate_evidence, evidence_base.
"""
from __future__ import annotations

from typing import Any

from engine import rules as R
from engine.confidence import assess_confidence
from engine.feasibility import assess, choose_cycle, seed_state
from engine.knowledge_base import KnowledgeBase, SUPPORTED, load_climate_evidence, load_kb
from engine.scoring import resolve_weights, sensitivity_range, sequence_scores, suitability_index
from engine.validation import validate_request

STATUS_ORDER = {"feasible_candidate": 0, "conditional_candidate": 1, "not_recommended": 2}
CRITERION_TRAITS = {
    "water": ("water_requirement", "drought_tolerance"), "soil_health": ("nitrogen_fixing", "nutrient_demand", "ground_cover_erosion"),
    "food": ("household_food_use",), "income": ("market_access", "input_cost"), "labour": ("labour_demand",),
}
# Crop-specific cautions taken from the knowledge-base sources (never invented here).
CAUTIONS = {
    "groundnut": [("risk", "Aflatoxin in stored groundnut can lower its market value and is a food-safety risk; drying and storage matter.", ["POINT22", "JFP"]),
                  ("risk", "Check for soil-borne disease and pest carry-over where groundnut is repeated; West African trials found lower legume yields in monoculture, but the cause was not established here.", ["JAS00"])],
    "maize": [("risk", "Maize yield can collapse if a dry spell falls around flowering and early grain filling; in 1997 nearly all Gambian maize was lost.", ["GIEWS97", "MENKIR"]),
              ("trade", "Maize needs nitrogen fertiliser; the farmer-reported urea price (about GMD 2,000) has no confirmed unit.", ["VISIT-01", "POINT22"])],
    "cowpea": [("risk", "Smallholder cowpea yields in West Africa are often only 10-20% of potential because of pests, disease and drought.", ["FTF23"]),
               ("risk", "Thrips and Maruca pod borer are major cowpea pests; storage pests also need planning.", ["SINGH"]),
               ("trade", "The nitrogen benefit to the next cereal was much smaller after cowpea than after groundnut in West African trials; the 0.6 credit used here is an assumption.", ["BAG01"])],
    "millet": [("risk", "Weaver birds and blister beetle damage early millet and farmers bird-scare from early morning to late evening.", ["MWG18"]),
               ("trade", "Millet and cowpea markets are thin compared with groundnut; market access for millet is an assumption.", ["CSA18"])],
    "sorghum": [("risk", "Striga and bird damage have not been confirmed for Manduar sorghum.", [])],
}


def _label(status: str) -> tuple[str, str]:
    if status == "farmer_reported":
        return "farmer_report", "FARMER REPORT"
    if status in SUPPORTED:
        scope = status.replace("sourced_", "")
        return "published_source", f"PUBLISHED SOURCE ({scope})"
    return "assumption", "ASSUMPTION"


class _Evidence:
    def __init__(self, kb: KnowledgeBase):
        self.kb, self.items = kb, []

    def add(self, statement: str, status: str, source_ids: list[str], cls: str | None = None):
        evidence_class, tag = _label(status)
        if cls:
            evidence_class, tag = cls, cls.replace("_", " ").upper()
        self.items.append({"id": f"e{len(self.items) + 1}", "statement": statement, "evidence_class": evidence_class,
                           "trait_status": status, "source_ids": list(source_ids)})

    def strings(self) -> list[str]:
        out = []
        for it in self.items:
            tag = it["evidence_class"].replace("_", " ").upper()
            src = f" [{', '.join(it['source_ids'])}]" if it["source_ids"] else ""
            out.append(f"{tag}: {it['statement']}{src}")
        return out


def _crop_list(cycle):
    return list(dict.fromkeys(cycle))


def _climate(features: dict) -> tuple[list[float], float, dict, list[str]]:
    clim = load_climate_evidence()
    by_thr = clim["dry_spells"]["exposure_by_threshold"]
    exposures = [by_thr["1.0"], by_thr["2.0"], by_thr["5.0"], 0.0]
    primary = by_thr[clim["dry_spells"]["primary_threshold_mm"]]
    notes = []
    override = features.get("dry_spell_season_share")
    override = override.get("value") if isinstance(override, dict) else override
    if isinstance(override, (int, float)) and not isinstance(override, bool) and 0 <= override <= 1:
        primary = float(override); exposures = sorted(set(exposures + [primary]))
        notes.append("dry-spell exposure supplied by the caller replaced the pilot default for the primary score")
    return sorted(set(exposures)), primary, clim, notes


def _feature_value(features: dict, key: str):
    v = features.get(key)
    return v.get("value") if isinstance(v, dict) else v


def _criterion_reason(crit, cycle, kb, parts, features, primary, clim):
    crops = _crop_list(cycle)
    traits = CRITERION_TRAITS[crit]
    total = len(crops) * len(traits)
    sup = sum(1 for c in crops for t in traits if kb.is_supported(c, t))
    base = {
        "water": "Crop water need and drought tolerance (" + ", ".join(f"{c}: need {kb.value(c, 'water_requirement')}, tolerance {kb.value(c, 'drought_tolerance')}" for c in crops) + ").",
        "soil_health": ("Nitrogen balance {n:.2f} and ground cover {e:.2f}; legume-then-cereal transitions {lc}, same-crop repeats {rp}. A fixing legume does not guarantee a nitrogen benefit to the next crop."
                        .format(n=parts["soil_health_components"]["nitrogen"], e=parts["soil_health_components"]["erosion"],
                                lc=parts["rotation_effects"]["legume_to_cereal_transitions"], rp=parts["rotation_effects"]["repeat_transitions"])),
        "food": "Household food use of the crops (" + ", ".join(f"{c}: {kb.value(c, 'household_food_use')}" for c in crops) + "). This is not a yield estimate.",
        "income": "Market access and input cost (" + ", ".join(f"{c}: market {kb.value(c, 'market_access')}, inputs {kb.value(c, 'input_cost')}" for c in crops) + "). No prices were scored.",
        "labour": "Labour demand (" + ", ".join(f"{c}: {kb.value(c, 'labour_demand')}" for c in crops) + "). Higher score means less labour.",
    }[crit]
    extra = ""
    if crit == "water":
        dr = clim["dry_spells"]["imerg"]
        extra = (f" Dry-spell exposure used: {primary:.2f} (7-day or longer July-September spells in {dr['seasons_with_spell_ge_7_days']} of {dr['seasons']} seasons, GPM IMERG, 1 mm dry-day threshold). "
                 "The threshold is unverified: 5 mm gives 8 of 11 seasons, so exposure is covered by the score range, not treated as fact.")
        mx = _feature_value(features, "dry_spell_max_days")
        if mx is not None:
            extra += f" Supplied maximum dry spell: {mx} days (context only; no threshold on this value is scored)."
    if crit == "soil_health":
        ctx = [f"{k} = {_feature_value(features, k)}" for k in ("slope_pct", "soc", "ph", "soil_texture") if _feature_value(features, k) is not None]
        if ctx:
            extra = " Area-level context supplied (" + ", ".join(ctx) + ") is shown but not scored; gridded data is not field measurement."
        if _feature_value(features, "ndvi_cover_nov_jun") is not None:
            extra += " MODIS NDVI is landscape vegetation context, not field residue cover."
    unsrc = f" {total - sup} of {total} traits behind this score have no source (scored neutral or as assumptions)." if total - sup else ""
    return base + extra + unsrc, round(sup / total, 2) if total else None


def _criteria_list(scores, weights, cycle, kb, parts, features, primary, clim):
    out = []
    for crit in R.CRITERIA:
        reason, share = _criterion_reason(crit, cycle, kb, parts, features, primary, clim)
        out.append({"name": crit, "label": R.CRITERION_LABELS[crit], "score": round(scores[crit] * 100, 1), "weight": round(weights[crit], 4),
                    "weighted_points": round(scores[crit] * weights[crit] * 100, 2), "reason": reason, "supported_trait_share": share})
    return out


def _narrative(sid, cycle, kb, parts, ref_parts, feas, features, primary, clim, weights):
    ev = _Evidence(kb)
    benefits, trade, risks = [], [], []
    crops = _crop_list(cycle)
    ev.add("Groundnut and maize are reported as grown by Manduar farmers; the pilot evidence is one farmer interview and 5 recorded fields.", "farmer_reported", ["VISIT-01"])
    for c in crops:
        if not kb.locally_confirmed(c):
            trade.append(f"{c.capitalize()} is not yet confirmed as grown or available in Manduar; its scores are pulled toward neutral until it is.")
        for t, what in (("drought_tolerance", "drought tolerance"), ("market_access", "market access"), ("input_cost", "input cost")):
            tr = kb.trait(c, t)
            if tr["value"] != "unknown" and len(ev.items) < 9:
                ev.add(f"{c}: {what} is {tr['value']}. {tr['note']}".strip(), tr["trait_status"], tr["source_ids"])
        if kb.value(c, "nitrogen_fixing") == "yes":
            benefits.append(f"{c.capitalize()} fixes nitrogen, but the benefit reaching the next crop depends on nodulation, residue management and nutrient removal and is not guaranteed.")
        if kb.value(c, "drought_tolerance") == "high":
            benefits.append(f"{c.capitalize()} is reported to tolerate dry conditions better than maize; this is general evidence, not proof for local varieties.")
        if kb.value(c, "market_access") == "easy":
            benefits.append(f"{c.capitalize()} has an easy market for Manduar farmers (farmer report).")
        for kind, text, sources in CAUTIONS.get(c, []):
            (trade if kind == "trade" else risks).append(text + (f" ({', '.join(sources)})" if sources else ""))
        if kb.value(c, "labour_demand") == "high":
            trade.append(f"{c.capitalize()} needs a lot of labour.")
        if kb.value(c, "market_access") in ("limited", "none"):
            trade.append(f"The market for {c} is limited, so income depends on finding buyers.")
    eff = parts["rotation_effects"]
    if eff["legume_to_cereal_transitions"]:
        ev.add("In Niger and Burkina Faso trials cereals grew better after legumes (more after groundnut than cowpea); the effect depends on species and site.", "sourced_regional", ["BAG00", "BAG01"])
        benefits.append("A cereal follows a legume in the cycle, which West African trials link to better cereal growth; this was not measured in Manduar.")
    if eff["repeat_transitions"]:
        ev.add("Legume yields were consistently lower in monoculture than when rotated with a cereal on sandy soil in West Africa.", "sourced_regional", ["JAS00"])
        trade.append("The same crop follows itself in this cycle, which is linked to lower yields in sandy West African soils.")
    dr = clim["dry_spells"]["imerg"]
    ev.add(f"GPM IMERG shows 7-day or longer July-September dry spells in {dr['seasons_with_spell_ge_7_days']} of {dr['seasons']} seasons (1 mm dry-day threshold, unverified); MERRA-2 cannot resolve dry spells. Area-level estimate, not field data.",
           "sourced_regional", ["IMERG-POWER"], cls="satellite_derived")
    if ref_parts is not None:
        names = {"water": "water use", "soil_health": "soil health", "food": "household food", "income": "income", "labour": "labour demand"}
        for crit in R.CRITERIA:
            d = (parts["criterion_scores"][crit] - ref_parts["criterion_scores"][crit]) * 100
            if d >= 5:
                benefits.append(f"Better {names[crit]} than your current rotation (+{d:.0f} points).")
            elif d <= -5:
                trade.append(f"Worse {names[crit]} than your current rotation ({d:.0f} points).")
    if feas["conditions"]:
        trade.extend(feas["conditions"])
    benefits = list(dict.fromkeys(benefits)) or ["No clear gain on any criterion over the alternatives is shown here."]
    trade = list(dict.fromkeys(trade)) or ["No clear loss is shown on any criterion; confirm costs and markets locally."]
    risks = list(dict.fromkeys(risks))
    risks.append("The effect sizes behind the score are rule-of-thumb weights, not measurements; the order of options is more reliable than the exact numbers.")
    return ev, benefits, trade, risks


def _status_note(status):
    return {"feasible_candidate": "Ready to consider with local review", "conditional_candidate": "Conditional: confirm the listed conditions first",
            "not_recommended": "Not recommended: a limit is violated"}[status]


def _history(farmer: dict, kb: KnowledgeBase):
    raw = farmer.get("rotation_history") or farmer.get("crop_history") or []
    crops, unknown = [], []
    for item in raw:
        crop = str(item.get("crop", "")).strip().lower() if isinstance(item, dict) else str(item).strip().lower()
        if not crop or crop in ("fallow", "none", "not sure"):
            continue
        (crops if kb.has_crop(crop) else unknown).append(crop)
    return crops, unknown


def evaluate(payload: dict[str, Any]) -> dict[str, Any]:
    payload = validate_request(payload or {})
    kb = load_kb()
    field_id = payload.get("field_id") or "unspecified-field"
    features, farmer, field, constraints = payload["features"], payload["farmer_context"], payload["field_context"], payload["constraints"]
    requested, weights, weight_source, warnings = resolve_weights(payload["weights"], farmer.get("priorities"))
    exposures, primary, clim, clim_notes = _climate(features)
    evidence_base = dict(kb.evidence_base_default)
    if isinstance(payload.get("evidence_base"), dict):
        evidence_base.update(payload["evidence_base"])

    history, unknown_history = _history(farmer, kb)
    ref = None
    ref_parts = None
    missing_inputs = []
    if not farmer.get("priorities") and not payload["weights"]:
        missing_inputs.append("farmer priorities (pilot defaults used)")
    if not (farmer.get("rotation_history") or farmer.get("crop_history")):
        missing_inputs.append("rotation history (no current-rotation comparison)")
    if not constraints.get("seed_access") and not farmer.get("available_crops") and not farmer.get("seed_available"):
        missing_inputs.append("seed availability for new crops")

    if history:
        ref_parts = sequence_scores(kb, history, primary, False, R.NOVELTY_SHRINK)
        lo, hi = sensitivity_range(kb, history, weights, exposures)
        idx = suitability_index(ref_parts["criterion_scores"], weights)
        conf, weak = assess_confidence(history, kb, evidence_base, [], len(missing_inputs), is_reference=True)
        ev = _Evidence(kb)
        ev.add("Crop history supplied for this field: " + ", ".join(history), "farmer_reported", ["VISIT-01"])
        if ref_parts["rotation_effects"]["repeat_transitions"]:
            ev.add("Legume yields were consistently lower in monoculture than when rotated with a cereal on sandy soil in West Africa.", "sourced_regional", ["JAS00"])
        ref = {"id": "current", "kind": "existing", "display_name": "Current rotation", "name": "Current rotation: " + " > ".join(history),
               "recommendation_status": "reference", "score": round(idx, 1), "score_range": [round(lo, 1), round(hi, 1)],
               "confidence": conf["level"], "confidence_detail": conf, "sequence": [{"year": i + 1, "crop": c} for i, c in enumerate(history)],
               "criteria": _criteria_list(ref_parts["criterion_scores"], weights, history, kb, ref_parts, features, primary, clim),
               "evidence": ev.strings(), "evidence_items": ev.items,
               "gaps": [f"Crop traits without a source: {'; '.join(weak[:6])}" if weak else "All scored traits have a source or farmer report",
                        "No measurements of soil or yield for this field"],
               "note": "Reference only: the farmer's own recorded rotation, scored with the same rules for comparison."}
    results = []
    for tpl in R.STRATEGIES:
        cycle = choose_cycle(tpl["cycle"], farmer, constraints, kb)
        feas = assess(cycle, tpl, farmer, constraints, kb)
        parts = sequence_scores(kb, cycle, primary, False, R.NOVELTY_SHRINK)
        lo, hi = sensitivity_range(kb, cycle, weights, exposures)
        idx = suitability_index(parts["criterion_scores"], weights)
        conf, weak = assess_confidence(cycle, kb, evidence_base, feas["unconfirmed_candidate_crops"], len(missing_inputs) + len(feas["input_gaps"]))
        ev, benefits, trade, risks = _narrative(tpl["id"], cycle, kb, parts, ref_parts, feas, features, primary, clim, weights)
        status = feas["status"]
        gaps = []
        if weak:
            gaps.append("Crop traits without a source: " + "; ".join(weak[:6]) + (" and more" if len(weak) > 6 else ""))
        gaps += [f"Not supplied: {m}" for m in missing_inputs] + [g[0].upper() + g[1:] for g in feas["input_gaps"]]
        gaps += [f"Optional feature not supplied (context only): {k}" for k in R.OPTIONAL_FEATURES if _feature_value(features, k) is None]
        gaps.append(f"Evidence base: {evidence_base.get('farmers_interviewed', 0)} farmer interviewed and {evidence_base.get('fields_recorded', 0)} recorded fields; no soil or yield measurements.")
        gaps.append("Rotation benefits come from sandy soils in Niger, Burkina Faso and Senegal, not from Manduar.")
        roles = {c: r for c, r in zip(cycle, tpl["roles"])}
        seasons = ["current_or_next", "following_season"] + [f"season_{i + 1}" for i in range(2, len(cycle))]
        scored = status != "not_recommended"
        results.append({
            "id": tpl["id"], "kind": tpl["kind"], "display_name": tpl["display_name"], "name": tpl["name"],
            "score": round(idx, 1) if scored else None,
            "score_range": [round(lo, 1), round(hi, 1)] if scored else None,
            "suitability_index": round(idx / 100, 3) if scored else None,
            "confidence": conf["level"], "confidence_detail": conf,
            "recommendation_status": status, "status_note": _status_note(status),
            "sequence": [{"season": seasons[i], "crop": c, "role": tpl["roles"][i] if i < len(tpl["roles"]) else kb.group(c)} for i, c in enumerate(cycle)],
            "criteria": _criteria_list(parts["criterion_scores"], weights, cycle, kb, parts, features, primary, clim) if scored else [],
            "soil_health_components": {k: round(v, 3) for k, v in parts["soil_health_components"].items()} if scored else None,
            "rotation_effects": parts["rotation_effects"],
            "why": tpl["summary"] + (" It is conditional: " + "; ".join(feas["conditions"] + [f"seed for {c} unconfirmed" for c in feas["unconfirmed_candidate_crops"]]) + "." if status == "conditional_candidate" else ""),
            "evidence": ev.strings(), "evidence_items": ev.items,
            "benefits": benefits, "trade_offs": trade, "gaps": gaps, "risks_for_local_review": risks,
            "constraints": {"feasible": status != "not_recommended", "failures": feas["failures"], "conditions": feas["conditions"],
                            "unavailable_crops": feas["unavailable_crops"], "unconfirmed_candidate_crops": feas["unconfirmed_candidate_crops"],
                            "would_become_feasible_if": feas["would_become_feasible_if"]},
        })
    results.sort(key=lambda s: (STATUS_ORDER[s["recommendation_status"]], -(s["score"] if s["score"] is not None else -1)))
    return _assemble(field_id, results, ref, requested, weights, weight_source, warnings + clim_notes, payload, features, missing_inputs,
                     evidence_base, clim, unknown_history)


def _suggestion(results, ref):
    ready = [s for s in results if s["recommendation_status"] == "feasible_candidate"]
    cond = [s for s in results if s["recommendation_status"] == "conditional_candidate"]
    conditional_options = [{"id": s["id"], "name": s["name"], "conditions": s["constraints"]["conditions"] + [f"confirm seed for {c}" for c in s["constraints"]["unconfirmed_candidate_crops"]]} for s in cond]
    text, top, overlap, conf = "", None, False, "low"
    if ready:
        top = ready[0]; conf = top["confidence"]
        second = ready[1] if len(ready) > 1 else None
        text = f"Among the options that are ready to consider, {top['name']} (option {top['id']}) scores highest at {top['score']:.0f} out of 100"
        if ref:
            text += f"; your current rotation scores {ref['score']:.0f}"
        if second:
            overlap = top["score_range"][0] <= second["score_range"][1] and second["score_range"][0] <= top["score_range"][1]
            text += f". It is {top['score'] - second['score']:.0f} points ahead of {second['name']}" + (", but the score ranges overlap, so the order is not reliable" if overlap else "")
        text += "."
        if ref and top["score_range"][0] <= ref["score_range"][1] and ref["score_range"][0] <= top["score_range"][1]:
            text += " Its score range overlaps your current rotation's range, so this comparison does not show a clear advantage."
    else:
        text = "No option is ready to consider yet: every option has a limit that is violated or a condition to confirm first."
    if conditional_options:
        text += " Conditional options (" + ", ".join(f"{o['id']}" for o in conditional_options) + ") are not ready until their conditions are confirmed; their scores show potential, not readiness."
    text += " This is a rule-based comparison, not a forecast of yield or income. Discuss it with an extension officer or experienced farmers before changing your fields."
    return {"ready_option": top["id"] if top else None, "text": text, "confidence": conf, "score_ranges_overlap": overlap, "conditional_options": conditional_options}


def _assemble(field_id, results, ref, requested, weights, weight_source, warnings, payload, features, missing_inputs, evidence_base, clim, unknown_history):
    missing_features = [k for k in R.OPTIONAL_FEATURES if _feature_value(features, k) is None]
    data_gaps = sorted({g for s in results for g in s["gaps"]})
    notes = ["Groundnut and maize are the only crops reported locally in the current Manduar notes.",
             "Other crops are conditional candidates until local cultivation, seed access and farmer acceptance are confirmed.",
             "Satellite and gridded soil products are contextual estimates, not field measurements."]
    if unknown_history:
        notes.append("Crops in the rotation history that are not in the knowledge base were ignored: " + ", ".join(unknown_history))
    return {
        "field_id": field_id, "engine_version": R.ENGINE_VERSION, "strategies": results, "reference_rotation": ref,
        "suggestion": _suggestion(results, ref),
        "weights": {k: round(v, 4) for k, v in weights.items()}, "weights_requested": requested, "weights_source": weight_source, "warnings": warnings,
        "constraints": payload["constraints"], "farmer_context": payload["farmer_context"], "field_context": payload["field_context"],
        "evidence_base": evidence_base,
        "climate_evidence": {"reference_period": clim["reference_period"], "dry_spells": clim["dry_spells"], "rainfall_agreement": clim["rainfall"]["agreement_summary"],
                             "ndvi_context": {"dataset": clim["ndvi_context"]["dataset"], "resolution": clim["ndvi_context"]["resolution"], "quality_rule": clim["ndvi_context"]["quality_rule"],
                                              "no_reliable_view_months": clim["ndvi_context"]["no_reliable_view_months"], "sparsest_cover_window": clim["ndvi_context"]["sparsest_cover_window"]},
                             "note": "NASA POWER (MERRA-2, GPM IMERG) and MODIS describe the wider area around the field, not the field itself."},
        "data_quality": {"status": "limited_pilot_evidence", "missing_features": missing_features, "missing_inputs": missing_inputs, "notes": notes, "gaps": data_gaps},
        "not_evaluated": ["Dry-season cover crop: not evaluated because the pilot reports no reliable dry-season water and animals graze fields after harvest.",
                          "Intercropping, rice-based rotations and soil or yield measurements are outside this version."],
        "recommendation_status": "decision_support_only",
        "assumptions": [
            "Scores are relative heuristic comparisons on a 0-100 scale, not probabilities or yield predictions.",
            "The default weights come from five recorded Manduar fields of one farmer and should be reviewed with farmers and an agronomist.",
            "Missing or unknown information is never treated as good or bad: unknown traits score neutral and are listed as gaps.",
            "Crops not yet confirmed locally have their scores pulled 30% toward neutral (a novelty discount; the 30% is an assumption).",
            "Rotation adjustments (legume then cereal, repeated crops) and the cowpea nitrogen credit of 0.6 are rule-of-thumb values, not measured effects.",
            "The dry-day threshold (1 mm) is unverified; exposure is also tested at 2 mm, 5 mm and with no dry spells resolved, and the score range spans these.",
            "MERRA-2 cannot resolve dry spells here, so dry-spell evidence rests on GPM IMERG only.",
            "The score range is a deterministic sensitivity range across those checks, not a statistical confidence interval.",
            "Options marked conditional are not ready to recommend until their conditions are confirmed.",
        ],
        "disclaimer": R.DISCLAIMER,
    }

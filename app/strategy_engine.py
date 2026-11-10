"""Transparent, rules-based crop-rotation decision support for AgroShift Gambia.

This is a pilot heuristic engine, not a yield predictor or a substitute for
local agronomic advice. It uses only the Python standard library.
"""
from __future__ import annotations

from typing import Any

DISCLAIMER = (
    "Decision-support output only. Scores are transparent heuristic suitability "
    "comparisons, not probabilities, yield forecasts, or validated agronomic "
    "recommendations. Confirm crop availability, varieties, soil conditions, "
    "and management with farmers and local agricultural extension staff."
)

DEFAULT_WEIGHTS = {
    "water_resilience": 0.25,
    "soil_fertility": 0.20,
    "erosion_management": 0.15,
    "food_security": 0.15,
    "economic_fit": 0.15,
    "practicality": 0.10,
}

# The two crops reported in the Manduar pilot notes are treated as locally
# observed. Other crops remain candidates until a farmer confirms their use
# and seed access.
STRATEGIES = [
    {
        "id": "A",
        "name": "Groundnut–maize rotation",
        "sequence": [
            {"season": "current_or_next", "crop": "groundnut", "role": "legume/oilseed"},
            {"season": "following_season", "crop": "maize", "role": "cereal"},
        ],
        "required_crops": ["groundnut", "maize"],
        "candidate_crops": [],
        "cover_crop": False,
        "summary": "A practical starting sequence using the two crops reported in the Manduar pilot notes.",
        "benefits": [
            "Uses crops already reported in the pilot area.",
            "Alternates a legume with a cereal rather than repeating the same crop family.",
            "Can fit household food and cash objectives, depending on local use and markets.",
        ],
        "trade_offs": [
            "Groundnut does not guarantee a nitrogen benefit to the following crop; nodulation, nutrient removal and residue management matter.",
            "Maize can be sensitive to dry spells around flowering and grain filling.",
            "Crop rotation alone does not correct low soil fertility.",
        ],
        "evidence": [
            "LOCAL-01: groundnut and maize reported as main crops; reported sequence includes groundnut (2024), maize (2025), groundnut (2026).",
            "NSP-01: national policy describes upland cereal and groundnut systems; this is national context, not proof of every local practice.",
        ],
        "risks": [
            "Confirm that the reported years refer to the same farmer and same plot.",
            "Confirm varieties, actual planting/harvest dates, seed quality and plot history.",
            "Check whether the field has serious groundnut disease or pest carryover.",
        ],
    },
    {
        "id": "B",
        "name": "Maize–cowpea diversification",
        "sequence": [
            {"season": "current_or_next", "crop": "maize", "role": "cereal"},
            {"season": "following_season", "crop": "cowpea", "role": "legume"},
        ],
        "required_crops": ["maize"],
        "candidate_crops": ["cowpea"],
        "cover_crop": False,
        "summary": "A diversification option that introduces cowpea as a legume, subject to local seed access and farmer acceptance.",
        "benefits": [
            "Adds a legume option to a maize-based sequence.",
            "May diversify household food and income sources where cowpea is accepted and marketable.",
            "Can diversify crop-family pressure compared with continuous cereal production.",
        ],
        "trade_offs": [
            "Cowpea cultivation and seed access have not yet been confirmed in Manduar.",
            "Cowpea can face pod pests and storage bruchids.",
            "Legume nitrogen fixation depends on effective nodulation and does not mean all fixed nitrogen remains in the field.",
        ],
        "evidence": [
            "NSP-01: cowpea is part of the wider Gambian crop context.",
            "LOCAL-01: local notes currently confirm groundnut and maize, not cowpea.",
        ],
        "risks": [
            "Do not recommend until farmer interest, seed availability, variety, food use and market access are confirmed.",
            "Assess pest pressure and harvest labour before suggesting adoption.",
        ],
    },
    {
        "id": "C",
        "name": "Drought-risk cereal diversification",
        "sequence": [
            {"season": "current_or_next", "crop": "millet or sorghum", "role": "drought-resilient cereal candidate"},
            {"season": "following_season", "crop": "groundnut or cowpea", "role": "legume candidate"},
        ],
        "required_crops": [],
        "candidate_crops": ["millet", "sorghum", "groundnut", "cowpea"],
        "cover_crop": False,
        "summary": "A risk-management option using locally adapted millet or sorghum varieties if farmers confirm availability and willingness.",
        "benefits": [
            "Can diversify the crop portfolio beyond maize and groundnut.",
            "Adapted millet and sorghum varieties may tolerate dry conditions better than maize.",
            "May provide a food-grain option under variable rainfall.",
        ],
        "trade_offs": [
            "Neither millet nor sorghum is yet confirmed as a Manduar pilot crop.",
            "Drought tolerance depends on species, variety, establishment and growth stage.",
            "Market demand, bird pressure, maturity duration and household preferences may limit suitability.",
        ],
        "evidence": [
            "NSP-01: millet and sorghum are recognized in national crop systems.",
            "LOCAL-01: pilot notes do not yet confirm their cultivation or seed availability in Manduar.",
        ],
        "risks": [
            "Do not activate until a farmer confirms the crop, named variety and reliable seed source.",
            "Match maturity duration to the observed rainy-season window.",
            "Do not assume sesame or pigeon pea are available market options.",
        ],
    },
]


def _number(value: Any) -> float | None:
    try:
        if value is None or isinstance(value, bool):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _feature(features: dict, key: str) -> dict:
    value = features.get(key, {})
    if isinstance(value, dict):
        return value
    return {"value": value}


def _feature_value(features: dict, key: str) -> Any:
    return _feature(features, key).get("value")


def _normalise_weights(weights: dict | None) -> dict[str, float]:
    supplied = weights or {}
    result = {}
    for key, default in DEFAULT_WEIGHTS.items():
        value = _number(supplied.get(key, default))
        result[key] = max(0.0, value if value is not None else default)
    total = sum(result.values())
    if total <= 0:
        return DEFAULT_WEIGHTS.copy()
    return {key: value / total for key, value in result.items()}


def _farmer_priority_score(strategy: dict, farmer: dict) -> float:
    """Score 0-100 based on farmer's explicit priorities, when supplied."""
    priorities = farmer.get("priorities") or {}
    if not isinstance(priorities, dict) or not priorities:
        return 60.0
    crop_preferences = farmer.get("preferred_crops") or []
    avoided = {str(x).lower() for x in (farmer.get("avoided_crops") or [])}
    crops = [x["crop"] for x in strategy["sequence"]]
    if any(c.lower() in avoided for c in crops):
        return 0.0
    if crop_preferences:
        preferred = {str(x).lower() for x in crop_preferences}
        return 85.0 if any(c.lower() in preferred for c in crops) else 45.0
    return 65.0


def _score_criteria(strategy: dict, features: dict, farmer: dict, field: dict) -> dict[str, dict]:
    # Start from conservative, strategy-specific qualitative priors. Missing
    # satellite/soil data does not get disguised as a measured score.
    is_a = strategy["id"] == "A"
    is_b = strategy["id"] == "B"
    criteria = {
        "water_resilience": 68.0 if is_a else (65.0 if is_b else 78.0),
        "soil_fertility": 70.0 if is_a or is_b else 62.0,
        "erosion_management": 55.0,
        "food_security": 70.0 if is_a else (65.0 if is_b else 60.0),
        "economic_fit": 65.0 if is_a else 55.0,
        "practicality": 82.0 if is_a else (48.0 if is_b else 35.0),
    }
    reasons = {
        "water_resilience": "Qualitative crop-system prior; no field-level crop water balance supplied.",
        "soil_fertility": "Legume-cereal diversification is a potential benefit, not a measured soil improvement.",
        "erosion_management": "No verified slope, runoff or ground-cover measurement supplied.",
        "food_security": "Food value depends on household preferences and actual crop use.",
        "economic_fit": "Market price, transport cost and farm-gate demand are not supplied.",
        "practicality": "Based on whether component crops are already reported locally and whether inputs are confirmed.",
    }

    dry_spell = _number(_feature_value(features, "dry_spell_max_days"))
    dry_spells = _number(_feature_value(features, "dry_spells_ge7d"))
    if dry_spell is not None:
        if dry_spell >= 14:
            criteria["water_resilience"] -= 12 if strategy["id"] == "A" else (-5 if strategy["id"] == "C" else 8)
            reasons["water_resilience"] = f"Maximum dry spell is {dry_spell:g} days; long dry spells increase risk, especially for maize."
        elif dry_spell <= 7:
            criteria["water_resilience"] += 5
            reasons["water_resilience"] = f"Maximum dry spell is {dry_spell:g} days in the supplied feature period."
    if dry_spells is not None and dry_spells >= 2:
        criteria["water_resilience"] -= 5 if strategy["id"] != "C" else 0
        reasons["water_resilience"] += f" {dry_spells:g} dry spells of at least seven days were recorded."

    slope = _number(_feature_value(features, "slope_pct"))
    if slope is not None:
        if slope >= 5:
            criteria["erosion_management"] -= 8
            reasons["erosion_management"] = f"Area-level slope is {slope:g}%; field runoff controls need assessment."
        elif slope <= 2:
            criteria["erosion_management"] += 5
            reasons["erosion_management"] = f"Area-level slope is {slope:g}%; field erosion still requires direct inspection."

    soc = _number(_feature_value(features, "soc"))
    if soc is not None:
        # SoilGrids SOC units must be checked upstream. Only relative ranking is safe.
        criteria["soil_fertility"] += 5 if soc >= 10 else -5
        reasons["soil_fertility"] = "Soil organic carbon feature supplied; confirm units/depth and treat gridded data as contextual."

    ndvi = _number(_feature_value(features, "ndvi_cover_nov_jun"))
    if ndvi is not None:
        reasons["erosion_management"] += " MODIS NDVI is landscape vegetation context, not a direct measure of field residue cover."
    if farmer:
        criteria["food_security"] = _farmer_priority_score(strategy, farmer)
        reasons["food_security"] = "Adjusted using the farmer's explicitly supplied crop preferences/avoidances."
    for key in criteria:
        criteria[key] = max(0.0, min(100.0, criteria[key]))
    return {key: {"score": round(value, 1), "reason": reasons[key]} for key, value in criteria.items()}


def _crop_availability(strategy: dict, farmer: dict, constraints: dict) -> tuple[bool, list[str], list[str]]:
    unavailable = []
    unknown = []
    available = {str(x).lower() for x in (farmer.get("available_crops") or [])}
    unavailable_set = {str(x).lower() for x in (farmer.get("unavailable_crops") or [])}
    seed_access = constraints.get("seed_access", {})
    if not isinstance(seed_access, dict):
        seed_access = {}
    for crop in strategy["required_crops"] + strategy["candidate_crops"]:
        if crop in unavailable_set or seed_access.get(crop) in ("unavailable", "none", False):
            unavailable.append(crop)
        elif crop in strategy["candidate_crops"] and crop not in available and seed_access.get(crop) not in ("available", "easy", True):
            unknown.append(crop)
    return not unavailable, unavailable, unknown


def _hard_checks(strategy: dict, farmer: dict, constraints: dict) -> list[str]:
    failures = []
    ok, unavailable, _ = _crop_availability(strategy, farmer, constraints)
    if not ok:
        failures.append("Required/candidate seed or crop unavailable: " + ", ".join(unavailable))
    if strategy["cover_crop"] and constraints.get("dry_season_water") in (False, "none", "unavailable"):
        failures.append("Dry-season cover crop is infeasible because reliable water is unavailable.")
    if strategy["cover_crop"] and constraints.get("post_harvest_grazing") is True and not constraints.get("grazing_management"):
        failures.append("Post-harvest grazing is reported but no grazing-management arrangement is supplied.")
    if constraints.get("labour_available") is False:
        failures.append("Farmer reports insufficient labour for the proposed strategy.")
    if constraints.get("budget_available") is False:
        failures.append("Farmer reports insufficient budget for required seed/inputs.")
    return failures


def _confidence(features: dict, farmer: dict, field: dict, unknown_crops: list[str]) -> tuple[str, list[str]]:
    missing = []
    for key in ("dry_spell_max_days", "slope_pct", "soil_texture", "soc", "ph"):
        if _feature_value(features, key) is None:
            missing.append(key)
    if not farmer.get("rotation_history"):
        missing.append("farmer rotation history")
    if not farmer.get("priorities"):
        missing.append("farmer priorities")
    if unknown_crops:
        missing.append("local crop/seed confirmation: " + ", ".join(unknown_crops))
    if len(missing) >= 6:
        return "low", missing
    if len(missing) >= 3:
        return "moderate", missing
    return "moderate", missing  # Pilot evidence remains limited even with complete inputs.


def recommend_strategies(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate strategies for a field and return frontend-friendly JSON."""
    field_id = payload.get("field_id") or "unspecified-field"
    features = payload.get("features") or {}
    farmer = payload.get("farmer_context") or {}
    field = payload.get("field_context") or {}
    constraints = payload.get("constraints") or {}
    weights = _normalise_weights(payload.get("weights"))

    results = []
    for strategy in STRATEGIES:
        feasible, unavailable, unknown = _crop_availability(strategy, farmer, constraints)
        failures = _hard_checks(strategy, farmer, constraints)
        criteria = _score_criteria(strategy, features, farmer, field)
        weighted_score = sum(criteria[key]["score"] * weights[key] for key in weights)
        confidence, gaps = _confidence(features, farmer, field, unknown)
        status = "feasible_candidate" if feasible and not failures else "not_recommended"
        if unknown and feasible:
            status = "conditional_candidate"
        if failures:
            status = "not_recommended"
        score = round(weighted_score, 1) if status != "not_recommended" else None
        score_range = [max(0, round(score - 12, 1)), min(100, round(score + 12, 1))] if score is not None else None
        results.append({
            "id": strategy["id"],
            "name": strategy["name"],
            "score": score,
            "score_range": score_range,
            "confidence": confidence,
            "recommendation_status": status,
            "sequence": strategy["sequence"],
            "criteria": [
                {"name": key, "score": value["score"], "weight": round(weights[key], 3), "reason": value["reason"]}
                for key, value in criteria.items()
            ],
            "why": strategy["summary"],
            "evidence": strategy["evidence"],
            "benefits": strategy["benefits"],
            "trade_offs": strategy["trade_offs"],
            "gaps": gaps,
            "risks_for_local_review": strategy["risks"],
            "constraints": {
                "feasible": not failures,
                "failures": failures,
                "unavailable_crops": unavailable,
                "unconfirmed_candidate_crops": unknown,
            },
        })

    results.sort(key=lambda item: (item["score"] is not None, item["score"] or -1), reverse=True)
    return {
        "field_id": field_id,
        "strategies": results,
        "weights": weights,
        "constraints": constraints,
        "farmer_context": farmer,
        "field_context": field,
        "data_quality": {
            "status": "limited_pilot_evidence",
            "missing_features": sorted({gap for item in results for gap in item["gaps"]}),
            "notes": [
                "Groundnut and maize are the only crops reported locally in the current Manduar notes.",
                "Other crops are conditional candidates until local cultivation, seed access and farmer acceptance are confirmed.",
                "Satellite and gridded soil products are contextual estimates, not field measurements.",
            ],
        },
        "recommendation_status": "decision_support_only",
        "assumptions": [
            "Scores are relative heuristic comparisons on a 0-100 scale, not probabilities or yield predictions.",
            "The default weights are project starting values and should be reviewed with farmers and an agronomist.",
            "A missing feature is not interpreted as a good or bad condition.",
            "No dry-season cover crop is included in the current strategies because the pilot notes report no nearby water and post-harvest grazing.",
        ],
        "disclaimer": DISCLAIMER,
    }

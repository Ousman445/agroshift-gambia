"""Constants, scoring tables and strategy templates for the AgroShift rule engine.

Everything here is a documented, adjustable heuristic. None of it is a measured effect size.
"""
from __future__ import annotations

ENGINE_VERSION = "1.0.0"

# The five farmer priorities. Output weights always use these keys and sum to 1.
CRITERIA = ("water", "soil_health", "food", "income", "labour")
CRITERION_LABELS = {
    "water": "Water use and drought risk",
    "soil_health": "Soil health (nitrogen balance and ground cover)",
    "food": "Household food security",
    "income": "Income (market access and input cost)",
    "labour": "Labour demand (higher score = less labour)",
}

# Default priorities from the Manduar pilot records (scale 0 to 3), used only when the caller supplies none.
DEFAULT_REQUESTED = {"water": 2, "soil_health": 3, "food": 3, "income": 3, "labour": 3}

# Earlier six-criterion weight names are still accepted and mapped to the five priorities.
LEGACY_WEIGHT_MAP = {
    "water_resilience": "water", "soil_fertility": "soil_health", "erosion_management": "soil_health",
    "food_security": "food", "economic_fit": "income", "practicality": "labour",
    "soil": "soil_health", "food_security_priority": "food",
}

TABLES = {
    "low_is_better": {"low": 0.8, "medium": 0.5, "high": 0.2},
    "tolerance": {"high": 0.8, "medium": 0.5, "low": 0.2},
    "market": {"easy": 0.8, "limited": 0.5, "none": 0.2},
    "cover": {"high": 0.8, "medium": 0.5, "low": 0.2},
    "food": {"staple": 0.9, "protein": 0.7, "protein_oil_cash": 0.7, "oil_cash": 0.4, "none": 0.3},
    "nutrient_demand": {"low": 0.5, "medium": 0.35, "high": 0.2},
}
NEUTRAL = 0.5
NITROGEN_FIXER_BASE = 0.5      # a fixing legume scores 0.5 + 0.3 * n_credit (groundnut 0.8)
NITROGEN_FIXER_SPAN = 0.3
LEGUME_THEN_CEREAL_BONUS = 0.2  # x credit-weighted share of legume-then-cereal transitions in the cycle
REPEAT_PENALTY_NITROGEN = 0.1   # x share of same-crop-twice-in-a-row transitions
REPEAT_PENALTY_INCOME = 0.1
DRY_SPELL_WEIGHT = 0.25         # water score minus 0.25 x exposure x (1 - drought tolerance)
NOVELTY_SHRINK = 0.7            # scores of crops not yet confirmed locally move only 70% away from neutral
SENSITIVITY_SHRINKS = (NOVELTY_SHRINK, 1.0)

# Three strategies with fixed ids A, B and C (API contract). Slots may list alternatives; the first available is used.
STRATEGIES = [
    {"id": "A", "kind": "soil_building", "display_name": "Option A", "name": "Groundnut–maize rotation",
     "cycle": [["groundnut"], ["maize"]], "roles": ["legume/oilseed", "cereal"], "cover_crop": False,
     "summary": "Alternates groundnut and maize so groundnut never follows groundnut. Both crops are reported as grown in Manduar."},
    {"id": "B", "kind": "legume_diversification", "display_name": "Option B", "name": "Maize–cowpea diversification",
     "cycle": [["maize"], ["cowpea"]], "roles": ["cereal", "legume"], "cover_crop": False,
     "summary": "Adds cowpea as a second legume. Cowpea cultivation and seed access are not confirmed in Manduar, so this stays conditional."},
    {"id": "C", "kind": "water_resilient", "display_name": "Option C", "name": "Drought-risk cereal diversification",
     "cycle": [["millet", "sorghum"], ["groundnut"]], "roles": ["drought-resilient cereal candidate", "legume/oilseed"], "cover_crop": False,
     "summary": "Uses millet (or sorghum) with groundnut to reduce dependence on maize. Neither cereal is confirmed in Manduar, so this stays conditional."},
]

AVAILABLE_WORDS = {"available", "easy", "yes", "true", "confirmed"}
UNAVAILABLE_WORDS = {"unavailable", "none", "no", "false", "not_available"}
LIMITED_WORDS = {"limited", "hard", "difficult"}

OPTIONAL_FEATURES = ("dry_spell_max_days", "slope_pct", "soil_texture", "soc", "ph")
DISCLAIMER = (
    "Decision-support output only. Scores are transparent heuristic suitability comparisons, not probabilities, "
    "yield forecasts, or validated agronomic recommendations. Confirm crop availability, varieties, soil conditions, "
    "and management with farmers and local agricultural extension staff."
)

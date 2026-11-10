# AgroShift Gambia: crop-rotation engine contribution

## Included
- `app/strategy_engine.py`: standard-library rules and transparent weighted scoring.
- `app/main.py`: existing GET routes retained, plus `POST /api/v2/strategies`.
- `tests/test_strategy_engine.py`: unit tests.

## Run locally
From the repository root:

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
uvicorn app.main:app --reload
```

## POST contract

`POST /api/v2/strategies`

Example request:

```json
{
  "field_id": "manduar-001",
  "features": {
    "dry_spell_max_days": {"value": 12, "unit": "days"},
    "dry_spells_ge7d": {"value": 2, "unit": "count"},
    "slope_pct": {"value": 3.2, "unit": "%"},
    "soc": {"value": 8.4, "unit": "g/kg"}
  },
  "farmer_context": {
    "rotation_history": [
      {"year": 2024, "crop": "groundnut"},
      {"year": 2025, "crop": "maize"},
      {"year": 2026, "crop": "groundnut"}
    ],
    "available_crops": ["groundnut", "maize"],
    "preferred_crops": ["groundnut", "maize"],
    "priorities": {"food_security": 1, "income": 1}
  },
  "field_context": {
    "farming_system": "rainfed",
    "location": "Brikama Manduar"
  },
  "weights": {
    "water_resilience": 0.25,
    "soil_fertility": 0.20,
    "erosion_management": 0.15,
    "food_security": 0.15,
    "economic_fit": 0.15,
    "practicality": 0.10
  },
  "constraints": {
    "dry_season_water": "none",
    "post_harvest_grazing": true,
    "seed_access": {"groundnut": "available", "maize": "available"}
  }
}
```

## Important design decisions
1. Hard feasibility checks are separate from suitability scoring.
2. Groundnut and maize are the only crops currently reported in the Manduar pilot notes.
3. Cowpea, millet and sorghum remain conditional until local cultivation, seed access and farmer acceptance are confirmed.
4. No dry-season cover crop is recommended by default because the current pilot notes report no nearby water and post-harvest grazing.
5. Scores are heuristic comparisons, not probabilities, yield forecasts or experimentally validated outcomes.
6. Missing NASA/soil features remain explicit gaps; missing values are never silently treated as good conditions.
7. Default weights are initial project settings and must be reviewed with farmers and an agronomist.

## Integration note for Ousman
The endpoint returns:
- `field_id`
- `strategies[]` with `score`, `score_range`, `confidence`, `recommendation_status`, `criteria`, `sequence`, `why`, `evidence`, `benefits`, `trade_offs`, `gaps`, `risks_for_local_review`, and `constraints`
- `weights`, `farmer_context`, `field_context`, `data_quality`, `assumptions`, and `disclaimer`

The existing GET routes and GET response schema are retained in `app/main.py`.

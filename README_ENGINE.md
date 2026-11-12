# AgroShift Gambia – Crop Rotation Decision Engine (v1.0)

A transparent, rule-based decision-support engine for the Manduar (Brikama, Western Region) pilot. It compares three crop-rotation strategies against the farmer's own rotation and explains every score.

**It is not a yield, income or success-probability model.** Scores are relative heuristic comparisons on a 0–100 scale. Confirm every option with farmers and local agricultural extension staff.

## Layout (standard library only; no NumPy or pandas)

| File | Role |
| --- | --- |
| `engine/knowledge_base.py`, `engine/data/knowledge_base.json` | Crop traits with source ids and a support status; 6 crops, 38 sources; validated on load |
| `engine/data/climate_evidence.json` | NASA POWER (MERRA-2, GPM IMERG) and MODIS pilot-point evidence; no exact coordinates |
| `engine/rules.py` | Criteria, scoring tables, strategy templates, constants |
| `engine/scoring.py` | Weights, crop and rotation scoring, sensitivity range (plus the original `calculate_weighted_score`) |
| `engine/feasibility.py` | Seed availability and hard limits (Stage 1) |
| `engine/confidence.py` | Confidence rules |
| `engine/evaluator.py` | Orchestration and explanation text |
| `engine/validation.py` | Request checks (plus the original geometry helpers) |
| `app/strategy_engine.py` | Backward-compatible entry point used by the API |

## How it works

**Stage 1: feasibility.** For each strategy, every crop needs a seed source. Explicit reports win; groundnut and maize count as available (farmers grow them); other crops are `unknown` until confirmed.
- A violated limit gives `not_recommended` with `score: null`: an unavailable crop, no money for a high-input crop (maize needs fertiliser), or insufficient labour for a labour-heavy sequence.
- An open question gives `conditional_candidate`: unconfirmed or limited seed, low budget with high-input crops, limited labour.
- Otherwise `feasible_candidate`. Unknown budget or labour is a recorded gap, not a failure.
- Results are sorted ready first, then conditional, then not recommended. **A conditional option never becomes the suggestion headline.**

**Stage 2: scoring.** Each crop scores 0–1 on five priorities from its traits; the rotation score is the average over the cycle plus small documented adjustments.

| Priority | From |
| --- | --- |
| `water` | water requirement and drought tolerance, minus 0.25 × dry-spell exposure × (1 − tolerance) |
| `soil_health` | mean of nitrogen balance (fixing legume 0.5 + 0.3 × credit, else by nutrient demand; +0.2 × credited legume-then-cereal share, −0.1 × repeat share) and ground cover |
| `food` | household food use of the crops (not yield) |
| `income` | 0.7 × market access + 0.3 × input cost, −0.1 × repeat share (no prices are scored) |
| `labour` | labour demand (higher score = less labour needed) |

Weights are the five priorities, normalised to sum to 1. Defaults (water 2, soil 3, food 3, income 3, labour 3 on a 0–3 scale) come from five recorded Manduar fields and are used only when the request supplies none.

**Missing data.** An unknown trait scores neutral (0.5), never good or bad, and is listed as a gap. Optional gridded layers (slope, soil, NDVI, dry-spell values) are shown as context but never scored.

**Crops not yet confirmed locally** (cowpea, millet, sorghum) have their scores pulled 30% toward neutral (a novelty discount; the 30% is an assumption). Cowpea carries no optimistic defaults: water requirement and labour are unknown, ground cover is a medium assumption, and its nitrogen credit is an assumed 0.6 versus 1.0 for groundnut.

**Sensitivity range (`score_range`).** The lowest and highest index across: dry-spell exposure at 1, 2 and 5 mm dry-day thresholds and with none resolved; unsourced traits kept or set to neutral; the novelty discount kept or removed. It is a deterministic robustness check, not a statistical confidence interval.

**Confidence** is `low`, `moderate` or `high` and describes how well supported a comparison is. It is `low` when fewer than 70% of the traits used are sourced, a crop is unconfirmed, the option is untested locally (fewer than three farmers), or several inputs are missing. `high` additionally needs an agronomist review, three or more farmers, at least 85% sourced traits, no unconfirmed crops and complete inputs, so it is unreachable in the pilot.

## Evidence classes

Every evidence item (`evidence_items`, and the labelled strings in `evidence`) is one of: `farmer_report` (Manduar field visit), `published_source` (with `source_ids` into the knowledge base; "sourced" means a document says it, not that an agronomist validated it for Manduar), `satellite_derived` (area-level NASA data) or `assumption` (no source). `trait_status` gives the finer scope (local, regional, general).

## NASA evidence and its limits

- **GPM IMERG** supplies the dry-spell exposure: 7-day or longer July–September spells in 3 of 11 seasons (2015–2025) at a 1 mm threshold, 8 of 11 at 5 mm. The threshold is unverified, so exposure is part of the sensitivity range.
- **MERRA-2** rainfall is kept for rainfall classes but is `not_used` for dry spells: it records at least 1 mm on about 90% of July–September days.
- **MODIS NDVI** (good-quality composites only) is landscape context: about 5–6 ha per pixel, nearly blind in July–September. It is never scored.
- None of this is field-level data.

## API

```
POST /api/v2/strategies      body: any of field_id, features, farmer_context, field_context, weights, constraints, evidence_base
GET  /api/v2/engine          criteria, default priorities, strategies, knowledge-base counts
GET  /health, /api/v2/fields/{id}, /api/v2/fallback/{id}   unchanged
```

Example:

```json
{
  "field_id": "manduar-A004",
  "farmer_context": {
    "rotation_history": [{"year": 2024, "crop": "groundnut"}, {"year": 2025, "crop": "groundnut"}, {"year": 2026, "crop": "groundnut"}],
    "available_crops": ["cowpea"], "cash_available": "low", "labour": "family_only"
  },
  "weights": {"water": 2, "soil_health": 3, "food": 3, "income": 3, "labour": 3}
}
```

Malformed bodies (wrong types) return HTTP 422. Full field list and changes: `docs/ENGINE_CONTRACT.md`, section 13.

## Run and test

```
pip install -r requirements.txt
uvicorn app.main:app --reload
python -m unittest discover -s tests -v      # 86 tests; API tests use a built-in ASGI client, no extra package
```

## Limitations

- Evidence base: one farmer interview and five recorded fields (7 seen). Priority counts come from one farmer.
- 35 of 102 crop traits are assumptions or unknown; the rotation evidence comes from sandy soils in Niger, Burkina Faso and Senegal, not Manduar.
- Rotation adjustments, the novelty discount and the cowpea credit are rule-of-thumb values, not measurements. The order of options is more reliable than the exact numbers.
- Prices, costs and units (for example urea at about GMD 2,000) are unconfirmed, so no money figures are scored or shown as results.
- Not evaluated: dry-season cover crops (no reliable dry-season water, grazing after harvest), intercropping, rice-based rotations.
- The GET field and fallback endpoints still serve demonstration data.
- Knowledge-base traits need review by an agronomist or extension officer before any claim beyond "decision support".


# AgroShift Gambia — Decision Engine Contract

## 1. Purpose

The AgroShift Gambia decision engine evaluates agricultural and farmer-provided information to produce three alternative agricultural strategies for a selected field.

It uses transparent, explainable rules rather than unsupported assumptions.

The engine is independent of the user interface and must return a consistent, structured response through the backend API.

## 2. Input Data

The engine receives structured field information through the backend.

Expected environmental and agricultural features include:

| Feature | Description | Source |
|---|---|---|
| rain_total_mm | Seasonal rainfall information, including ranges and rankings | NASA POWER and GPM IMERG |
| dry_spell_max_days | Maximum consecutive dry-spell duration | NASA POWER and GPM IMERG |
| dry_spells_ge7d | Number of dry spells lasting at least seven days | NASA POWER and GPM IMERG |
| ndvi_cover_nov_jun | Landscape vegetation-cover context | MODIS MOD13Q1 |
| slope_pct | Area-level slope information | SRTM |
| soil_texture | Soil texture information | SoilGrids |
| soc | Soil organic carbon | SoilGrids |
| ph | Soil acidity or alkalinity | SoilGrids |

Each feature must retain its source, spatial resolution, observation period, data type, units and relevant quality information.

Farmer-provided information and environmental evidence must remain distinguishable.

## 3. Data Validation

Before evaluating a field, the system must:

- Check whether required features are available.
- Identify missing, invalid or incomplete values.
- Preserve original source metadata.
- Avoid treating missing values as zero.
- Distinguish farmer-reported, observed, satellite-derived and modelled information.
- Identify conflicting information between datasets.
- Record important limitations rather than inventing values.

## 4. Strategy Generation

The engine produces three alternative strategies.

### Strategy A — soil_building

Groundnut–maize rotation.

Both crops are reported as grown by Manduar farmers. This is the only option currently considered ready without further crop confirmation.

### Strategy B — legume_diversification

Maize–cowpea diversification.

Cowpea cultivation and seed access are not confirmed locally. This strategy remains conditional until these are verified.

### Strategy C — water_resilient

Millet or sorghum with groundnut.

Neither millet nor sorghum is confirmed locally. This strategy remains conditional until seed access is confirmed.

The farmer's recorded rotation is returned separately as `reference_rotation` with ID `current`. It is scored using the same rules for comparison and is not one of the three proposed strategies.

Agricultural practices must be based on the approved crop knowledge base and reviewed rules.

The engine must not invent crop requirements or present unverified practices as established recommendations.

## 5. Evaluation Criteria

Strategies are evaluated against five farmer priorities:

- `water`
- `soil_health`
- `food`
- `income`
- `labour`

Weights are configurable per request.

Rainfall, dry-spell, soil, slope and vegetation information may be included as documented evidence and context.

NASA POWER, GPM IMERG and MODIS describe conditions around a field, not necessarily conditions across the entire farm. Gridded soil, slope and vegetation values are contextual evidence.

**Environmental evidence from the current field-level cache is not used in strategy scoring.**

The cached environmental evidence summary is attached separately by the API. It is not passed into the evaluator and must not change strategy scores or score ranges.

The importance assigned to each criterion is documented in `README_ENGINE.md`.

Weights are configurable rather than permanently hardcoded.

## 6. Expected Output

Each field evaluation must return:

- `field_id`
- `strategies`
- `weights`
- `constraints`
- `farmer_context`
- `field_context`
- `data_quality`
- `recommendation_status`
- `assumptions`
- `disclaimer`

Each strategy must contain:

- `id`
- `name`
- `score`
- `score_range`
- `confidence`
- `recommendation_status`
- `sequence`
- `criteria`
- `why`
- `evidence`
- `benefits`
- `trade_offs`
- `gaps`
- `risks_for_local_review`
- `constraints`

Strategies must use IDs A, B and C.

Scores must not imply scientific certainty. Their meaning and calculation method must be documented.

## 7. Confidence and Uncertainty

The engine must communicate uncertainty clearly.

Confidence should consider:

- Data availability.
- Data quality.
- Source agreement.
- Spatial resolution.
- Relevance of information to the selected field.
- Strength of the supporting agricultural rules.

Missing or conflicting information must lower confidence where relevant.

The engine must not assign high confidence simply because a strategy has a high score.

Pilot recommendations must not be presented with high confidence.

## 8. Evidence and Explainability

Every strategy must explain why it was generated.

Evidence should identify the feature, value or range, source and relevant interpretation supporting the strategy.

The system must make it possible for users and reviewers to understand how a recommendation was reached.

Contextual evidence must be clearly distinguished from evidence actually used in scoring.

## 9. Environmental Evidence and Technical Restrictions

The current environmental evidence cache is stored at:

`pipeline/cache/field-001.json`

It contains:

| Dataset | Records |
|---|---:|
| NASA POWER annual features | 11 |
| MODIS NDVI usable November–June observations | 173 |
| SoilGrids records | 24 |
| SRTM elevation samples | 9 |
| SMAP monthly snapshots | 44 |

The evidence covers the Manduar pilot location in Brikama, The Gambia, with a reference period of 2015–2025.

The API exposes this evidence through:

`GET /api/v2/evidence/{field_id}`

The strategy endpoint also attaches an environmental evidence summary:

`POST /api/v2/strategies`

The summary is identified by:

`environmental_evidence`

Its scoring-use declaration is:

`context_only_not_used_in_scoring`

The following restrictions apply:

- Rainfall sources must be compared using ranges and rankings where appropriate.
- Do not make unsupported absolute rainfall claims.
- Dry-spell calculations must use the July–September period specified in the technical plan.
- NDVI represents landscape vegetation greenness, not direct crop stress or yield.
- SoilGrids and SRTM data must be treated as area-level context.
- SMAP soil-moisture estimates must not be represented as field measurements.
- Missing observations must never silently become zero.
- Sentinel-2 evidence remains provisional and excluded from engine scoring and recommendations.
- The new MODIS evidence package must not be silently merged with older climate summaries while their calculation methods remain unreconciled.
- Environmental evidence must not influence strategy scores unless a separately reviewed and tested change to the scoring contract is approved.

## 10. Integration

The intended system flow is:

1. The data pipeline processes and validates source datasets.
2. Processed environmental evidence is stored in the local cache.
3. The backend provides available cached evidence through the API.
4. The decision engine validates and evaluates its approved inputs.
5. The backend returns three structured strategies.
6. The API attaches the separate environmental evidence summary.
7. The interface can display strategies, evidence, benefits, trade-offs and limitations.

The engine must remain independent of the user interface.

The API must not require live NASA or other remote environmental-data requests to produce a strategy response.

## 11. Review and Disclaimer

All strategies are decision-support suggestions, not guaranteed agricultural outcomes.

Farmers and local agricultural experts must review recommendations before implementation.

The engine must clearly communicate missing information, uncertainty and risks requiring local review.

## 12. Current Development Status

`POST /api/v2/strategies` is served by the engine in the `engine/` package. Its version is available through `GET /api/v2/engine`.

The GET field and fallback endpoints return demonstration data.

The engine uses a sourced crop knowledge base and pilot-point NASA evidence for Manduar, Brikama.

The pilot evidence is based on one farmer interview and five recorded fields.

The environmental evidence cache is available separately and is attached to the strategy API response as contextual metadata.

The current cache summary does not affect scoring.

Rules, scoring weights and crop traits remain subject to agricultural review. Thirty-five of 102 traits are unsourced assumptions or unknown, and pilot strategy confidence remains low.

## 13. Final Engine Response — v1.0

Request fields are optional:

- `field_id`
- `features`
- `farmer_context`
- `field_context`
- `weights`
- `constraints`
- `evidence_base`

### Weights

`weights` accepts any of:

- `water`
- `soil_health`
- `food`
- `income`
- `labour`

Values must be non-negative numbers. Unspecified keys retain the pilot defaults.

Earlier names are still accepted and mapped:

- `water_resilience`
- `soil_fertility`
- `erosion_management`
- `food_security`
- `economic_fit`
- `practicality`

Output weights always use the five current keys and sum to 1.

### Farmer Context

`farmer_context.priorities` contains the farmer's own selections. Unspecified priorities count as zero. Explicit `weights` take precedence.

`farmer_context.rotation_history` or `crop_history` accepts a list of `{year, crop}` records and produces `reference_rotation`.

### Seed Availability

Seed availability can be supplied through:

- `farmer_context.available_crops`
- `farmer_context.seed_available`
- `farmer_context.unavailable_crops`
- `constraints.seed_access`

`constraints.seed_access` accepts crop availability values such as `available`, `easy`, `limited`, `unavailable` or `none`.

Groundnut and maize count as available unless reported otherwise. Other crops remain unknown until confirmed.

### Other Constraints

Supported constraints include:

- `constraints.budget_available`
- `farmer_context.cash_available` (`none`, `low`, `medium`, `high`)
- `constraints.labour_available`
- `farmer_context.labour` (`family_only`, `can_hire`)
- `constraints.dry_season_water`
- `constraints.post_harvest_grazing`

### Response Additions

Per-strategy additions:

- `kind`
- `display_name`
- `status_note`
- `suitability_index`
- `confidence_detail`
- `evidence_items`
- `soil_health_components`
- `rotation_effects`
- `constraints.conditions`
- `constraints.would_become_feasible_if`

Top-level additions:

- `engine_version`
- `reference_rotation`
- `suggestion`
- `weights_requested`
- `weights_source`
- `warnings`
- `evidence_base`
- `climate_evidence`
- `not_evaluated`

The API may additionally attach `environmental_evidence`. This is a separate contextual metadata object, not an engine scoring input.

### Scoring and Confidence

`score` and `score_range` remain on a 0–100 scale. The range is a sensitivity range, not a fixed band.

Criteria names are the five farmer priorities.

Confidence remains `low`, `moderate` or `high`. High confidence is not permitted in the current pilot.

A strategy with an open condition is a `conditional_candidate`, not a ready recommendation, and is sorted after ready options.

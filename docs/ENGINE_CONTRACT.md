
# AgroShift Gambia – Decision Engine Contract

## 1. Purpose

The decision engine evaluates environmental and agricultural data for a selected field and produces three possible agricultural strategies.

It translates field-level features into structured recommendations that can be displayed by the AgroShift Gambia interface.

The engine must use transparent, explainable rules rather than unsupported assumptions.

## 2. Input Data

The engine receives field data from the backend API.

Expected input features:

| Feature | Description | Source |
|---|---|---|
| rain_total_mm | Seasonal rainfall information, including ranges and rankings | MERRA-2 and IMERG |
| dry_spell_max_days | Maximum consecutive dry-spell duration | MERRA-2 and IMERG |
| dry_spells_ge7d | Number of dry spells lasting at least seven days | MERRA-2 and IMERG |
| ndvi_cover_nov_jun | Landscape vegetation-cover context | MODIS MOD13Q1 |
| slope_pct | Area-level slope information | SRTM |
| soil_texture | Soil texture information | SoilGrids |
| soc | Soil organic carbon | SoilGrids |
| ph | Soil acidity or alkalinity | SoilGrids |

Each feature should retain its source, resolution, observation period, data type and confidence information.

## 3. Data Validation

Before evaluating a field, the engine must:

- Check whether required features are available.
- Identify missing or invalid values.
- Preserve the original source metadata.
- Avoid treating missing values as zero.
- Distinguish observed, satellite-derived and modelled information.
- Identify conflicting information between datasets.

If important data is missing, the engine must record the limitation rather than inventing a value.

## 4. Strategy Generation

The engine produces three alternative strategies:

### Strategy A (kind `soil_building`)
Groundnut–maize rotation. Both crops are reported as grown by Manduar farmers, so this is the only option that can be ready without further confirmation.

### Strategy B (kind `legume_diversification`)
Maize–cowpea diversification. Cowpea cultivation and seed access are not confirmed locally, so it is conditional until they are.

### Strategy C (kind `water_resilient`)
Millet (or sorghum) with groundnut. Neither cereal is confirmed locally, so it is conditional until seed access is confirmed.

The farmer's own recorded rotation is returned separately as `reference_rotation` (id `current`) and scored with the same rules for comparison. It is not one of the three strategies.

The exact agricultural practices must be based on the approved crop knowledge base and reviewed rules.

The engine must not invent crop requirements or present unverified practices as established recommendations.

## 5. Evaluation Criteria

Strategies are scored on the five farmer priorities: `water`, `soil_health`, `food`, `income` and `labour`.
Weights are configurable per request (see section 13). Rainfall, dry-spell, soil, slope and vegetation information is used as documented evidence and context:
NASA POWER, GPM IMERG and MODIS describe the area around a field, not the field itself, and gridded soil, slope and NDVI values are shown but never scored.

The importance assigned to each criterion is documented in `README_ENGINE.md`.

Weights are configurable rather than permanently hardcoded.

## 6. Expected Output

Each field evaluation must return:

- field_id
- strategies
- weights
- constraints
- disclaimer

Each strategy must contain:

- id
- name
- score
- score_range
- confidence
- criteria
- sequence
- why
- evidence
- benefits
- trade_offs
- gaps
- risks_for_local_review

Strategies must use IDs A, B and C.

Scores must not imply scientific certainty. Their meaning and calculation method must be documented.

## 7. Confidence and Uncertainty

The engine must communicate uncertainty clearly.

Confidence should consider:

- Data availability.
- Data quality.
- Source agreement.
- Spatial resolution.
- Relevance of the data to the selected field.
- Strength of the supporting agricultural rules.

Missing or conflicting information must lower confidence where relevant.

The engine must not assign high confidence simply because a strategy has a high score.

## 8. Evidence and Explainability

Every strategy must explain why it was generated.

Evidence should identify the feature, value or range, source and relevant interpretation supporting the strategy.

The system should make it possible for users and reviewers to understand how a recommendation was reached.

## 9. Important Technical Restrictions

- Rainfall sources must be compared using ranges and rankings where appropriate.
- Do not make unsupported absolute rainfall claims.
- Dry-spell calculations must use the July–September period specified in the technical plan.
- NDVI must represent landscape vegetation-cover context, not direct crop stress.
- SoilGrids and SRTM data must be treated as area-level context.
- Rainfall-based strategy evidence must not exceed medium confidence under the project rules.
- Missing data must never silently become zero.

## 10. Integration

The intended system flow is:

1. The data pipeline produces processed field features.
2. The backend provides the features through the API.
3. The decision engine validates and evaluates the input.
4. The engine returns three structured strategies.
5. The frontend displays the strategies, evidence, benefits, trade-offs and limitations.

The engine should be independent of the user interface.

## 11. Review and Disclaimer

All strategies are decision-support suggestions, not guaranteed agricultural outcomes.

Farmers and local agricultural experts must review recommendations before implementation.

The engine must clearly communicate missing information, uncertainty and risks requiring local review.

## 12. Current Development Status

`POST /api/v2/strategies` is served by the engine in the `engine/` package (version in `GET /api/v2/engine`).
The GET field and fallback endpoints still return demonstration data.

The engine uses a sourced crop knowledge base and pilot-point NASA evidence for Manduar (Brikama). The pilot evidence is one farmer interview and five recorded fields.
Rules, scoring weights and crop traits remain subject to agricultural review; 35 of 102 traits are unsourced assumptions or unknown, and every card is low confidence.

## 13. Final engine response (v1.0)

Request (all fields optional): `field_id`, `features`, `farmer_context`, `field_context`, `weights`, `constraints`, `evidence_base`.

- `weights`: any of `water`, `soil_health`, `food`, `income`, `labour` (non-negative numbers; unspecified keys keep the pilot default). The earlier names `water_resilience`, `soil_fertility`, `erosion_management`, `food_security`, `economic_fit` and `practicality` are still accepted and mapped. Output weights always use the five keys and sum to 1.
- `farmer_context.priorities`: the farmer's own selection; unspecified priorities then count as 0. `weights` takes precedence.
- `farmer_context.rotation_history` (or `crop_history`): list of `{year, crop}`; produces `reference_rotation`.
- Seed: `farmer_context.available_crops` / `seed_available` / `unavailable_crops` and `constraints.seed_access` (`{crop: available|easy|limited|unavailable|none}`). Groundnut and maize count as available unless reported otherwise; other crops are unknown until confirmed.
- Limits: `constraints.budget_available`, `farmer_context.cash_available` (`none|low|medium|high`), `constraints.labour_available`, `farmer_context.labour` (`family_only|can_hire`), `constraints.dry_season_water`, `constraints.post_harvest_grazing`.

Response additions (existing keys are unchanged): per strategy `kind`, `display_name`, `status_note`, `suitability_index`, `confidence_detail`, `evidence_items`, `soil_health_components`, `rotation_effects`, `constraints.conditions`, `constraints.would_become_feasible_if`; top level `engine_version`, `reference_rotation`, `suggestion`, `weights_requested`, `weights_source`, `warnings`, `evidence_base`, `climate_evidence`, `not_evaluated`.

Changes from the earlier engine: `score` and `score_range` remain on a 0-100 scale, but the range is now a sensitivity range, not a fixed band; criteria names are the five priorities; `confidence` stays `low`, `moderate` or `high` (never `high` in the pilot); a strategy with an open condition is `conditional_candidate`, not a ready recommendation, and is sorted after ready options.

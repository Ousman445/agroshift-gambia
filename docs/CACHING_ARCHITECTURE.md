
# AgroShift Gambia — Caching Architecture

## 1. Purpose

AgroShift Gambia uses precomputed environmental data.

The application must never make live NASA or other remote environmental-data requests while a user is using the application.

Environmental data is processed separately, validated, stored locally and served by the backend.

## 2. Data Flow

1. Data processing scripts retrieve and process source datasets.
2. Processed results are validated and organized into field-level evidence.
3. Results are saved locally as JSON or CSV files.
4. The backend reads the cached files and serves the available evidence through the API.
5. The strategy engine evaluates its approved inputs independently.
6. The API returns strategy recommendations alongside available environmental evidence.

## 3. Directory Structure

- `pipeline/` — Data processing and cache-generation scripts.
- `pipeline/cache/` — Precomputed field-level environmental evidence.
- `app/` — Backend API and application logic.
- `engine/` — Decision engine and agricultural evaluation rules.
- `engine/data/` — Supporting climate evidence and knowledge data.
- `data/source_archives/` — Original agricultural evidence handoff files.
- `docs/evidence/` — Agricultural evidence register and supporting documentation.

## 4. Environmental Evidence Cache

The current pilot cache is:

`pipeline/cache/field-001.json`

It contains five evidence collections:

| Dataset | Records |
|---|---:|
| NASA POWER annual features | 11 |
| MODIS NDVI usable November–June observations | 173 |
| SoilGrids records | 24 |
| SRTM elevation samples | 9 |
| SMAP monthly snapshots | 44 |

The cache represents the Manduar pilot location in Brikama, The Gambia.

Its reference period is 2015–2025.

These counts describe records in the processed cache. They do not represent independent field measurements.

## 5. Cache Requirements

- Store processed results in JSON or CSV format.
- Never retrieve NASA data directly from the application during user requests.
- Preserve missing values as null rather than treating them as zero.
- Retain dataset source, spatial resolution, observation period, units and relevant quality metadata.
- Preserve original source datasets.
- Keep data processing separate from API request handling.
- Allow cached evidence to be updated without changing the API response contract.
- Validate generated JSON before it is served.

## 6. Evidence Interpretation and Limitations

Environmental evidence is contextual information, not a substitute for field measurements.

- NASA POWER provides gridded climate information.
- MODIS NDVI describes vegetation greenness, not crop yield or direct crop stress.
- SMAP provides coarse-resolution soil-moisture estimates.
- SoilGrids provides modelled soil-property estimates, not laboratory measurements.
- SRTM provides satellite-derived elevation, not a ground survey.

The datasets have different spatial resolutions and may not represent the entire farm.

Missing observations must remain missing. They must not be silently imputed as zero.

Sentinel-2 evidence remains provisional and is excluded from engine scoring and recommendations pending further validation.

## 7. Backend Integration

The backend exposes cached environmental evidence through:

`GET /api/v2/evidence/{field_id}`

The strategy endpoint also attaches an environmental evidence summary:

`POST /api/v2/strategies`

The summary includes:

- Evidence availability.
- Field identifier.
- Handoff date.
- Reference period.
- Dataset record counts.
- Scoring-use declaration.
- Evidence limitations.

The current environmental evidence summary is contextual metadata only.

It is not passed into the strategy evaluator and does not change strategy scores.

## 8. Static Fallback

A static fallback response may be used when the backend is unavailable.

The fallback should contain a previously generated and validated response with the same expected structure as the API response.

The fallback must clearly identify itself as saved demonstration data and must not be presented as live or recently updated evidence.

## 9. Responsibilities

- Data processing and scientific validation: Technical lead.
- Cache structure, backend integration and deployment: Systems lead.
- Interface integration and fallback display: Interface lead.

## 10. Important Restrictions

- Never depend on live NASA requests to produce a field recommendation.
- Never treat missing data as zero.
- Never present satellite-derived or modelled information as direct farm measurements.
- Never include provisional Sentinel-2 evidence in scoring.
- Never imply that contextual environmental evidence has influenced strategy scores when it has not.

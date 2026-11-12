import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 2:
    raise SystemExit(
        "Usage: python3 pipeline/build_cache.py /path/to/AgroShift_Pilot_Data_Handoff_20261111"
    )

SOURCE = Path(sys.argv[1])
OUTPUT = Path("pipeline/cache/field-001.json")


def read_csv(relative_path):
    path = SOURCE / relative_path
    if not path.exists():
        raise FileNotFoundError(path)

    with path.open(encoding="utf-8-sig", newline="") as file:
        return list(csv.DictReader(file))


def number(value):
    if value is None or value.strip() == "":
        return None
    return float(value)


def integer(value):
    if value is None or value.strip() == "":
        return None
    return int(value)


# 1. POWER: retain the complete reference-period annual observations.
annual_rows = read_csv("POWER/annual_features.csv")
annual = []

for row in annual_rows:
    if row["in_reference_period"].lower() != "true":
        continue

    annual.append({
        "year": integer(row["year"]),
        "rainfall_window_days": integer(row["rain_window_days"]),
        "dry_spell_window_days": integer(row["spell_window_days"]),
        "merra2": {
            "rain_total_mm": number(row["rain_total_mm_merra2"]),
            "rainy_days": integer(row["rainy_days_merra2"]),
            "longest_dry_spell_days": integer(
                row["longest_dry_spell_d_merra2"]
            ),
            "dry_spells_ge7_days": integer(
                row["dry_spells_ge7d_merra2"]
            ),
            "rain_missing_days": integer(
                row["rain_missing_days_merra2"]
            ),
            "spell_missing_days": integer(
                row["spell_missing_days_merra2"]
            ),
        },
        "imerg": {
            "rain_total_mm": number(row["rain_total_mm_imerg"]),
            "rainy_days": integer(row["rainy_days_imerg"]),
            "longest_dry_spell_days": integer(
                row["longest_dry_spell_d_imerg"]
            ),
            "dry_spells_ge7_days": integer(
                row["dry_spells_ge7d_imerg"]
            ),
            "rain_missing_days": integer(
                row["rain_missing_days_imerg"]
            ),
            "spell_missing_days": integer(
                row["spell_missing_days_imerg"]
            ),
        },
    })


# 2. MODIS: retain the handoff's usable observations (reliability 0 and 1).
ndvi_rows = read_csv("MODIS/ndvi_series.csv")
ndvi = []

for row in ndvi_rows:
    if row["usable"].lower() != "true":
        continue

    month = integer(row["month"].split("-")[1])
    if month not in (11, 12, 1, 2, 3, 4, 5, 6):
        continue

    ndvi.append({
        "date": row["date"],
        "year": integer(row["year"]),
        "month": row["month"],
        "ndvi": number(row["ndvi"]),
        "reliability": integer(row["reliability"]),
        "quality_label": row["quality_label"],
    })


# 3. SoilGrids: retain every property and depth without selecting one.
soil_rows = read_csv("SoilGrids/pilot_soilgrids_converted.csv")
soil = []

for row in soil_rows:
    soil.append({
        "property": row["property"],
        "depth": row["depth"],
        "value": number(row["converted_value"]),
        "unit": row["unit"],
        "quantile": row["quantile"],
        "source": row["source"],
    })


# 4. SRTM: retain the elevation samples; do not infer slope.
elevation_rows = read_csv("SRTM/pilot_elevation_samples.csv")
elevation = []

for row in elevation_rows:
    elevation.append({
        "latitude": number(row["latitude"]),
        "longitude": number(row["longitude"]),
        "row_offset": integer(row["row_offset"]),
        "column_offset": integer(row["column_offset"]),
        "elevation_m": number(row["elevation_m"]),
    })


# 5. SMAP: retain monthly snapshots and their quality/distance information.
smap_rows = read_csv("SMAP/smap_pilot_moisture.csv")
smap = []

for row in smap_rows:
    smap.append({
        "year": integer(row["year"]),
        "month": integer(row["month"]),
        "granule_time_utc": row["granule_time_utc"],
        "distance_from_pilot_km": number(
            row["distance_from_pilot_km"]
        ),
        "surface_soil_moisture_m3_m3": number(
            row["surface_soil_moisture_m3_m3"]
        ),
        "surface_quality": row["surface_quality"],
        "rootzone_soil_moisture_m3_m3": number(
            row["rootzone_soil_moisture_m3_m3"]
        ),
        "rootzone_quality": row["rootzone_quality"],
    })


cache = {
    "schema_version": "1.0",
    "field_id": "field-001",
    "location": {
        "name": "Brikama Manduar, The Gambia",
        "latitude": 13.24890667,
        "longitude": -16.61527333,
    },
    "handoff_generated": "2026-11-11",
    "reference_period": {
        "start_year": 2015,
        "end_year": 2025,
    },
    "features": {
        "rain_total_mm": {
            "value": None,
            "status": "source_specific_annual_observations_retained",
        },
        "dry_spell_max_days": {
            "value": None,
            "status": "source_specific_annual_observations_retained",
        },
        "dry_spells_ge7d": {
            "value": None,
            "status": "source_specific_annual_observations_retained",
        },
        "ndvi_cover_nov_jun": {
            "value": None,
            "status": "usable_november_to_june_observations_retained",
        },
        "slope_pct": {
            "value": None,
            "status": "not_calculated",
        },
        "soil_texture": {
            "value": None,
            "status": "incomplete_without_silt_fraction",
        },
        "soc": {
            "value": None,
            "status": "all_depths_retained_no_depth_selected",
        },
        "ph": {
            "value": None,
            "status": "all_depths_retained_no_depth_selected",
        },
    },
    "evidence": {
        "power_annual": annual,
        "modis_ndvi_nov_jun_usable": ndvi,
        "soilgrids": soil,
        "srtm_elevation_samples": elevation,
        "smap_monthly_snapshots": smap,
    },
    "methodology": {
        "modis_usable_reliability_values": [0, 1],
        "modis_season": "November-June",
        "rainfall_window": "June-October",
        "dry_spell_window": "July-September",
        "dry_day_threshold_mm": 1,
        "dry_spell_threshold_days": 7,
        "missing_values": "preserved_as_null",
        "slope": "not_inferred",
        "soil_texture": "not_inferred_without_silt",
        "soil_depths": "preserved_separately",
        "smap": "mid-month_snapshots_not_monthly_averages",
    },
}

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(cache, indent=2) + "\n", encoding="utf-8")

print(f"Created: {OUTPUT}")
print(f"POWER reference years: {len(annual)}")
print(f"MODIS usable Nov-Jun observations: {len(ndvi)}")
print(f"SoilGrids records: {len(soil)}")
print(f"SRTM elevation samples: {len(elevation)}")
print(f"SMAP snapshots: {len(smap)}")
print(f"Output size: {OUTPUT.stat().st_size:,} bytes")

"""Crop knowledge base loader and validator (standard library only).

Every trait carries a trait_status that says how well supported it is:
  farmer_reported   told by Manduar farmers (field visit)
  sourced_local     a Gambian document supports it
  sourced_regional  a West African or Sahel study supports it
  sourced_general   a source from elsewhere or a general review supports it
  assumption        no source yet; shown to users as an assumption
  unknown           no information; scored neutral, never as good or bad
"Sourced" means a cited document says it. It does not mean an agronomist has validated it for Manduar.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"
SUPPORTED = ("farmer_reported", "sourced_local", "sourced_regional", "sourced_general")
UNSUPPORTED = ("assumption", "unknown")
VALID_STATUSES = SUPPORTED + UNSUPPORTED
SCORED_TRAITS = (
    "water_requirement", "drought_tolerance", "nitrogen_fixing", "nutrient_demand", "ground_cover_erosion",
    "household_food_use", "market_access", "input_cost", "labour_demand",
)
REQUIRED_TRAITS = SCORED_TRAITS + ("crop_group", "residue_livestock_value", "seed_availability", "pests_diseases")


def validate_kb(data: dict) -> list[str]:
    """Return a list of problems (empty if the knowledge base is consistent)."""
    errors: list[str] = []
    sources = data.get("sources") or {}
    for crop, traits in (data.get("crops") or {}).items():
        for name in REQUIRED_TRAITS:
            if name not in traits:
                errors.append(f"{crop}: missing trait {name}")
        for name, trait in traits.items():
            if name.startswith("_"):
                continue
            status = trait.get("trait_status")
            if status not in VALID_STATUSES:
                errors.append(f"{crop}.{name}: invalid trait_status {status!r}")
            ids = trait.get("source_ids") or []
            if status in SUPPORTED and not ids:
                errors.append(f"{crop}.{name}: status {status} needs at least one source id")
            for sid in ids:
                if sid not in sources:
                    errors.append(f"{crop}.{name}: unknown source id {sid}")
    return errors


class KnowledgeBase:
    def __init__(self, data: dict):
        problems = validate_kb(data)
        if problems:
            raise ValueError("Invalid knowledge base: " + "; ".join(problems[:5]))
        self.data = data
        self.crops: dict[str, dict] = data["crops"]
        self.sources: dict[str, dict] = data["sources"]
        self.evidence_base_default: dict = data.get("evidence_base_default", {})

    def has_crop(self, crop: str) -> bool:
        return crop in self.crops

    def trait(self, crop: str, name: str) -> dict:
        return self.crops[crop][name]

    def value(self, crop: str, name: str) -> Any:
        return self.crops[crop][name]["value"]

    def is_supported(self, crop: str, name: str) -> bool:
        return self.crops[crop][name]["trait_status"] in SUPPORTED

    def locally_confirmed(self, crop: str) -> bool:
        return bool(self.crops[crop].get("_meta", {}).get("locally_confirmed"))

    def group(self, crop: str) -> str:
        return self.value(crop, "crop_group")

    def source_label(self, source_id: str) -> str:
        return self.sources.get(source_id, {}).get("cite", source_id)


@lru_cache(maxsize=1)
def load_kb() -> KnowledgeBase:
    with open(DATA_DIR / "knowledge_base.json", encoding="utf-8") as fh:
        return KnowledgeBase(json.load(fh))


@lru_cache(maxsize=1)
def load_climate_evidence() -> dict:
    with open(DATA_DIR / "climate_evidence.json", encoding="utf-8") as fh:
        return json.load(fh)

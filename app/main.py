
"""AgroShift Gambia API v2."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.strategy_engine import recommend_strategies
from engine.knowledge_base import load_kb
from engine.rules import (
    CRITERIA,
    CRITERION_LABELS,
    DEFAULT_REQUESTED,
    ENGINE_VERSION,
    STRATEGIES,
)

app = FastAPI(
    title="AgroShift Gambia API",
    description="Agricultural decision-support API",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://remix-agroshift-gambia-8001.ai.studio",
        "https://agroshift.vercel.app",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = Path(__file__).parent / "data.json"
FALLBACK_FILE = Path(__file__).parent / "static_fallback.json"
EVIDENCE_FILE = (
    Path(__file__).parent.parent
    / "pipeline"
    / "cache"
    / "field-001.json"
)


@lru_cache(maxsize=1)
def load_environmental_evidence():
    """Load locally cached environmental evidence."""
    try:
        with EVIDENCE_FILE.open(encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, dict):
            return None

        return data

    except (OSError, json.JSONDecodeError):
        return None


def environmental_evidence_summary(field_id: str) -> dict:
    """Return environmental evidence metadata without using it in scoring."""
    data = load_environmental_evidence()

    if data is None:
        return {
            "status": "unavailable",
            "scoring_use": "not_used",
        }

    cached_field_id = data.get("field_id")

    if cached_field_id != field_id:
        return {
            "status": "not_available_for_requested_field",
            "requested_field_id": field_id,
            "cached_field_id": cached_field_id,
            "scoring_use": "not_used",
        }

    evidence = data.get("evidence", {})

    if not isinstance(evidence, dict):
        evidence = {}

    record_counts = {}

    for name, records in evidence.items():
        if isinstance(records, list):
            record_counts[name] = len(records)
        else:
            record_counts[name] = None

    return {
        "status": "available",
        "field_id": cached_field_id,
        "handoff_generated": data.get("handoff_generated"),
        "reference_period": data.get("reference_period"),
        "dataset_record_counts": record_counts,
        "scoring_use": "context_only_not_used_in_scoring",
        "limitations": [
            "Environmental datasets are contextual evidence, not field measurements.",
            "The datasets have different spatial resolutions.",
            "Missing values are preserved and are not treated as zero.",
            "Sentinel-2 is excluded pending further validation.",
        ],
    }


class Feature(BaseModel):
    value: Any = None
    range: Any = None
    rank: Any = None
    quality_filter: str | None = None
    unit: str | None = None
    dataset: str | None = None
    datasets: list[str] | None = None
    resolution: str | None = None
    period: str | None = None
    data_type: str | None = None
    confidence: str = "unassessed"
    notes: str | None = None


class Strategy(BaseModel):
    id: str
    name: str
    score: float | None = None
    score_range: list[float] | None = None
    confidence: str = "unassessed"
    criteria: list[Any] = Field(default_factory=list)
    sequence: list[Any] = Field(default_factory=list)
    why: str
    evidence: list[Any] = Field(default_factory=list)
    benefits: list[Any] = Field(default_factory=list)
    trade_offs: list[Any] = Field(default_factory=list)
    gaps: list[Any] = Field(default_factory=list)
    risks_for_local_review: list[Any] = Field(default_factory=list)


class FieldData(BaseModel):
    field_id: str
    location: dict[str, Any]
    features: dict[str, Feature]
    strategies: list[Strategy]
    weights: dict[str, Any]
    constraints: dict[str, Any]
    disclaimer: str


class StrategyRequest(BaseModel):
    """Input contract for the POST strategy evaluator."""

    field_id: str = "field-001"
    features: dict[str, Any] = Field(default_factory=dict)
    farmer_context: dict[str, Any] = Field(default_factory=dict)
    field_context: dict[str, Any] = Field(default_factory=dict)
    weights: dict[str, Any] = Field(default_factory=dict)
    constraints: dict[str, Any] = Field(default_factory=dict)
    evidence_base: dict[str, Any] | None = None


def load_field_data(file_path: Path):
    try:
        with file_path.open("r", encoding="utf-8") as file:
            return json.load(file)

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Field data file is missing",
        )

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Field data contains invalid JSON",
        )


def verify_field_id(field_data: dict, field_id: str):
    if field_data.get("field_id") != field_id:
        raise HTTPException(
            status_code=404,
            detail="Field not found",
        )

    return field_data


@app.get("/")
def home():
    return {
        "message": "AgroShift Gambia API is running",
        "version": "2.2.0",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/v2/fields/{field_id}", response_model=FieldData)
def get_field(field_id: str):
    field_data = load_field_data(DATA_FILE)
    return verify_field_id(field_data, field_id)


@app.get("/api/v2/fallback/{field_id}", response_model=FieldData)
def get_static_fallback(field_id: str):
    field_data = load_field_data(FALLBACK_FILE)
    return verify_field_id(field_data, field_id)


@app.get("/api/v2/evidence/{field_id}")
def get_field_evidence(field_id: str):
    evidence_data = load_field_data(EVIDENCE_FILE)
    return verify_field_id(evidence_data, field_id)


@app.post("/api/v2/strategies")
def create_strategies(request: StrategyRequest):
    """Evaluate crop-rotation strategies and attach contextual evidence metadata."""
    try:
        result = recommend_strategies(request.model_dump())

        result["environmental_evidence"] = (
            environmental_evidence_summary(request.field_id)
        )

        return result

    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid strategy input: {exc}",
        ) from exc


@app.get("/api/v2/engine")
def engine_info():
    """Return read-only metadata about the strategy engine."""
    kb = load_kb()

    traits = [
        trait
        for crop in kb.crops.values()
        for name, trait in crop.items()
        if not name.startswith("_")
    ]

    supported = sum(
        1
        for trait in traits
        if trait["trait_status"] not in ("assumption", "unknown")
    )

    return {
        "engine_version": ENGINE_VERSION,
        "criteria": [
            {
                "name": criterion,
                "label": CRITERION_LABELS[criterion],
            }
            for criterion in CRITERIA
        ],
        "default_priorities_0_to_3": DEFAULT_REQUESTED,
        "strategies": [
            {
                "id": strategy["id"],
                "kind": strategy["kind"],
                "display_name": strategy["display_name"],
                "name": strategy["name"],
            }
            for strategy in STRATEGIES
        ],
        "crops": sorted(kb.crops),
        "knowledge_base": {
            "traits": len(traits),
            "traits_with_source_or_farmer_report": supported,
            "sources": len(kb.sources),
        },
        "disclaimer": (
            "Heuristic suitability comparison; "
            "not a yield or probability prediction."
        ),
    }


import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


app = FastAPI(
    title="AgroShift Gambia API",
    description="Agricultural decision-support API",
    version="2.0.0"
)

DATA_FILE = Path(__file__).parent / "data.json"
FALLBACK_FILE = Path(__file__).parent / "static_fallback.json"


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


def load_field_data(file_path: Path):
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            return json.load(file)

    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Field data file is missing"
        )

    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Field data contains invalid JSON"
        )


def verify_field_id(field_data: dict, field_id: str):
    if field_data.get("field_id") != field_id:
        raise HTTPException(
            status_code=404,
            detail="Field not found"
        )

    return field_data


@app.get("/")
def home():
    return {
        "message": "AgroShift Gambia API is running",
        "version": "2.0.0"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/api/v2/fields/{field_id}", response_model=FieldData)
def get_field(field_id: str):
    field_data = load_field_data(DATA_FILE)
    return verify_field_id(field_data, field_id)


@app.get("/api/v2/fallback/{field_id}", response_model=FieldData)
def get_static_fallback(field_id: str):
    field_data = load_field_data(FALLBACK_FILE)
    return verify_field_id(field_data, field_id)

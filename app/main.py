import json
from pathlib import Path

from fastapi import FastAPI, HTTPException

app = FastAPI(
    title="AgroShift Gambia API",
    description="Mock API for the AgroShift Gambia agricultural decision-support system",
    version="2.0.0"
)

DATA_FILE = Path(__file__).parent / "data.json"


@app.get("/")
def home():
    return {
        "message": "AgroShift Gambia API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/api/v2/fields/{field_id}")
def get_field(field_id: str):
    with open(DATA_FILE, "r", encoding="utf-8") as file:
        field_data = json.load(file)

    if field_data["field_id"] != field_id:
        raise HTTPException(
            status_code=404,
            detail="Field not found"
        )

    return field_data
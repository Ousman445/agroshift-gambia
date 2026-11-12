"""Backward-compatible entry point for the strategy engine.

The implementation lives in the `engine` package (standard library only). This module keeps the original import path
`from app.strategy_engine import recommend_strategies` working for the API and existing callers.
"""
from __future__ import annotations

from typing import Any

from engine.evaluator import evaluate
from engine.rules import CRITERIA, DEFAULT_REQUESTED, DISCLAIMER, ENGINE_VERSION  # noqa: F401

_total = sum(DEFAULT_REQUESTED.values())
DEFAULT_WEIGHTS = {key: DEFAULT_REQUESTED[key] / _total for key in CRITERIA}


def recommend_strategies(payload: dict[str, Any]) -> dict[str, Any]:
    """Evaluate crop-rotation strategies A, B and C for a field and return frontend-friendly JSON."""
    return evaluate(payload)

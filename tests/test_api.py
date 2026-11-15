
import unittest

from app.main import StrategyRequest, app
from app.strategy_engine import recommend_strategies
from tests.helpers import call

CONTRACT_KEYS = {
    "field_id",
    "strategies",
    "weights",
    "constraints",
    "farmer_context",
    "field_context",
    "data_quality",
    "recommendation_status",
    "assumptions",
    "disclaimer",
}

STRATEGY_KEYS = {
    "id",
    "name",
    "score",
    "score_range",
    "confidence",
    "recommendation_status",
    "sequence",
    "criteria",
    "why",
    "evidence",
    "benefits",
    "trade_offs",
    "gaps",
    "risks_for_local_review",
    "constraints",
}

EXPECTED_EVIDENCE_COUNTS = {
    "power_annual": 11,
    "modis_ndvi_nov_jun_usable": 173,
    "soilgrids": 24,
    "srtm_elevation_samples": 9,
    "smap_monthly_snapshots": 44,
}


class ExistingEndpointTests(unittest.TestCase):
    def test_health(self):
        status, body = call(app, "GET", "/health")
        self.assertEqual(status, 200)

    def test_field_data_and_fallback_are_preserved(self):
        for path in ("/api/v2/fields/field-001", "/api/v2/fallback/field-001"):
            status, body = call(app, "GET", path)
            self.assertEqual(status, 200, path)
            self.assertIn("strategies", body)

    def test_unknown_field_is_404(self):
        status, _ = call(app, "GET", "/api/v2/fields/does-not-exist")
        self.assertEqual(status, 404)

    def test_field_evidence_returns_all_dataset_sections(self):
        status, body = call(app, "GET", "/api/v2/evidence/field-001")

        self.assertEqual(status, 200)
        self.assertEqual(body["field_id"], "field-001")

        evidence = body["evidence"]

        self.assertEqual(set(evidence), set(EXPECTED_EVIDENCE_COUNTS))

        for dataset, expected_count in EXPECTED_EVIDENCE_COUNTS.items():
            with self.subTest(dataset=dataset):
                self.assertEqual(len(evidence[dataset]), expected_count)

    def test_unknown_evidence_field_is_404(self):
        status, _ = call(app, "GET", "/api/v2/evidence/unknown-field")
        self.assertEqual(status, 404)

    def test_docs_are_served(self):
        status, _ = call(app, "GET", "/openapi.json")
        self.assertEqual(status, 200)


class StrategiesEndpointTests(unittest.TestCase):
    def test_minimal_request_returns_the_full_contract(self):
        status, body = call(
            app,
            "POST",
            "/api/v2/strategies",
            {"field_id": "manduar-001"},
        )

        self.assertEqual(status, 200)
        self.assertTrue(CONTRACT_KEYS <= set(body))
        self.assertEqual(
            {s["id"] for s in body["strategies"]},
            {"A", "B", "C"},
        )

        for strategy in body["strategies"]:
            self.assertTrue(STRATEGY_KEYS <= set(strategy), strategy["id"])

        self.assertEqual(body["recommendation_status"], "decision_support_only")

    def test_environmental_evidence_summary_is_attached(self):
        status, body = call(
            app,
            "POST",
            "/api/v2/strategies",
            {"field_id": "field-001"},
        )

        self.assertEqual(status, 200)
        self.assertIn("environmental_evidence", body)

        summary = body["environmental_evidence"]

        self.assertEqual(summary["status"], "available")
        self.assertEqual(summary["field_id"], "field-001")
        self.assertEqual(
            summary["dataset_record_counts"],
            EXPECTED_EVIDENCE_COUNTS,
        )
        self.assertEqual(
            summary["scoring_use"],
            "context_only_not_used_in_scoring",
        )
        self.assertTrue(summary["limitations"])

    def test_environmental_evidence_does_not_change_strategy_scores(self):
        payload = {"field_id": "field-001"}

        status, api_body = call(
            app,
            "POST",
            "/api/v2/strategies",
            payload,
        )

        self.assertEqual(status, 200)

        request = StrategyRequest(**payload)
        direct_result = recommend_strategies(request.model_dump())

        api_strategies = {
            strategy["id"]: strategy
            for strategy in api_body["strategies"]
        }
        direct_strategies = {
            strategy["id"]: strategy
            for strategy in direct_result["strategies"]
        }

        self.assertEqual(set(api_strategies), set(direct_strategies))

        for strategy_id in api_strategies:
            with self.subTest(strategy=strategy_id):
                self.assertEqual(
                    api_strategies[strategy_id]["score"],
                    direct_strategies[strategy_id]["score"],
                )
                self.assertEqual(
                    api_strategies[strategy_id]["score_range"],
                    direct_strategies[strategy_id]["score_range"],
                )

    def test_weights_use_the_five_priorities_and_sum_to_one(self):
        status, body = call(
            app,
            "POST",
            "/api/v2/strategies",
            {"weights": {"water": 1, "food": 1}},
        )

        self.assertEqual(status, 200)
        self.assertEqual(
            set(body["weights"]),
            {"water", "soil_health", "food", "income", "labour"},
        )
        self.assertAlmostEqual(sum(body["weights"].values()), 1.0, places=3)

    def test_seed_confirmation_changes_status_through_the_api(self):
        _, before = call(app, "POST", "/api/v2/strategies", {})
        _, after = call(
            app,
            "POST",
            "/api/v2/strategies",
            {"farmer_context": {"available_crops": ["cowpea"]}},
        )

        status = lambda body: next(
            s for s in body["strategies"] if s["id"] == "B"
        )["recommendation_status"]

        self.assertEqual(status(before), "conditional_candidate")
        self.assertEqual(status(after), "feasible_candidate")

    def test_unavailable_crop_returns_null_score(self):
        _, body = call(
            app,
            "POST",
            "/api/v2/strategies",
            {"constraints": {"seed_access": {"groundnut": "unavailable"}}},
        )

        strategy_a = next(s for s in body["strategies"] if s["id"] == "A")

        self.assertIsNone(strategy_a["score"])
        self.assertEqual(strategy_a["recommendation_status"], "not_recommended")

    def test_reference_rotation_and_suggestion_are_returned(self):
        history = [
            {"year": 2024, "crop": "groundnut"},
            {"year": 2025, "crop": "groundnut"},
            {"year": 2026, "crop": "groundnut"},
        ]

        _, body = call(
            app,
            "POST",
            "/api/v2/strategies",
            {"farmer_context": {"rotation_history": history}},
        )

        self.assertEqual(
            body["reference_rotation"]["recommendation_status"],
            "reference",
        )
        self.assertIn("suggestion", body)

    def test_malformed_bodies_are_rejected(self):
        bad_bodies = (
            {"weights": [1, 2]},
            {"features": "x"},
            {"farmer_context": {"rotation_history": "groundnut"}},
            {"constraints": {"seed_access": []}},
        )

        for bad in bad_bodies:
            status, _ = call(app, "POST", "/api/v2/strategies", bad)
            self.assertIn(status, (400, 422), str(bad))

    def test_engine_metadata_endpoint(self):
        status, body = call(app, "GET", "/api/v2/engine")

        self.assertEqual(status, 200)
        self.assertEqual(
            [c["name"] for c in body["criteria"]],
            ["water", "soil_health", "food", "income", "labour"],
        )
        self.assertEqual(
            [s["id"] for s in body["strategies"]],
            ["A", "B", "C"],
        )
        self.assertGreater(
            body["knowledge_base"]["traits"],
            body["knowledge_base"]["traits_with_source_or_farmer_report"],
        )


if __name__ == "__main__":
    unittest.main()

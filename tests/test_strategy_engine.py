import unittest

from app.strategy_engine import recommend_strategies


class StrategyEngineTests(unittest.TestCase):
    def test_returns_three_strategies_and_contract(self):
        result = recommend_strategies({"field_id": "manduar-001"})
        self.assertEqual(result["field_id"], "manduar-001")
        self.assertEqual(len(result["strategies"]), 3)
        self.assertIn("weights", result)
        self.assertIn("data_quality", result)
        self.assertIn("disclaimer", result)

    def test_groundnut_maize_is_most_practical_default(self):
        result = recommend_strategies({"field_id": "manduar-001"})
        self.assertEqual(result["strategies"][0]["id"], "A")

    def test_cowpea_is_conditional_until_confirmed(self):
        result = recommend_strategies({"field_id": "manduar-001"})
        strategy_b = next(x for x in result["strategies"] if x["id"] == "B")
        self.assertEqual(strategy_b["recommendation_status"], "conditional_candidate")
        self.assertIn("cowpea", strategy_b["constraints"]["unconfirmed_candidate_crops"])

    def test_candidate_becomes_more_feasible_when_seed_confirmed(self):
        result = recommend_strategies({
            "field_id": "manduar-001",
            "farmer_context": {"available_crops": ["cowpea"], "preferred_crops": ["cowpea", "maize"]},
        })
        strategy_b = next(x for x in result["strategies"] if x["id"] == "B")
        self.assertEqual(strategy_b["recommendation_status"], "feasible_candidate")

    def test_missing_data_does_not_crash_or_claim_high_confidence(self):
        result = recommend_strategies({"field_id": "manduar-001", "features": {}})
        self.assertNotEqual(result["strategies"][0]["confidence"], "high")
        self.assertIn("limited_pilot_evidence", result["data_quality"]["status"])

    def test_custom_weight_normalisation(self):
        result = recommend_strategies({
            "weights": {"water_resilience": 2, "soil_fertility": 2}
        })
        total = sum(result["weights"].values())
        self.assertAlmostEqual(total, 1.0, places=6)

    def test_unavailable_required_crop_blocks_strategy(self):
        result = recommend_strategies({
            "constraints": {"seed_access": {"groundnut": "unavailable"}}
        })
        strategy_a = next(x for x in result["strategies"] if x["id"] == "A")
        self.assertEqual(strategy_a["recommendation_status"], "not_recommended")
        self.assertIsNone(strategy_a["score"])

    def test_dry_spell_changes_water_reasoning(self):
        result = recommend_strategies({
            "features": {"dry_spell_max_days": {"value": 16, "unit": "days"}}
        })
        strategy_a = next(x for x in result["strategies"] if x["id"] == "A")
        water = next(x for x in strategy_a["criteria"] if x["name"] == "water_resilience")
        self.assertIn("16", water["reason"])


if __name__ == "__main__":
    unittest.main()

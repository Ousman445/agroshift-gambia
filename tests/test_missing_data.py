import unittest

from app.strategy_engine import recommend_strategies
from engine.knowledge_base import load_kb
from engine.scoring import crop_scores
from engine.validation import validate_request


class MissingDataTests(unittest.TestCase):
    def test_empty_request_works_and_is_honest_about_gaps(self):
        r = recommend_strategies({})
        self.assertEqual(r["field_id"], "unspecified-field")
        self.assertEqual(len(r["strategies"]), 3)
        self.assertEqual(r["data_quality"]["status"], "limited_pilot_evidence")
        self.assertIn("rotation history (no current-rotation comparison)", r["data_quality"]["missing_inputs"])
        self.assertIsNone(r["reference_rotation"])

    def test_none_sections_are_treated_as_empty(self):
        r = recommend_strategies({"features": None, "farmer_context": None, "constraints": None, "weights": None, "field_context": None})
        self.assertEqual(len(r["strategies"]), 3)

    def test_missing_optional_features_are_listed_not_scored(self):
        r = recommend_strategies({"features": {"slope_pct": {"value": 3.2}}})
        self.assertNotIn("slope_pct", r["data_quality"]["missing_features"])
        self.assertIn("soc", r["data_quality"]["missing_features"])
        base = recommend_strategies({"features": {}})
        a, b = r["strategies"][0], base["strategies"][0]
        self.assertEqual(a["score"], b["score"])   # gridded context is shown, never scored

    def test_gridded_soil_and_slope_values_do_not_change_scores(self):
        loud = recommend_strategies({"features": {"slope_pct": 12, "soc": 2, "ph": 4.1, "dry_spell_max_days": 40}})
        quiet = recommend_strategies({})
        self.assertEqual([s["score"] for s in loud["strategies"]], [s["score"] for s in quiet["strategies"]])

    def test_unknown_crops_in_history_are_ignored_and_reported(self):
        r = recommend_strategies({"farmer_context": {"rotation_history": [{"crop": "rice"}, {"crop": "maize"}, {"crop": "fallow"}]}})
        self.assertEqual([c["crop"] for c in r["reference_rotation"]["sequence"]], ["maize"])
        self.assertTrue(any("rice" in n for n in r["data_quality"]["notes"]))

    def test_history_of_only_unknown_crops_gives_no_reference(self):
        r = recommend_strategies({"farmer_context": {"rotation_history": [{"crop": "rice"}]}})
        self.assertIsNone(r["reference_rotation"])

    def test_unknown_trait_values_are_neutral(self):
        kb = load_kb()
        scores = crop_scores(kb, "cowpea", 0.0, shrink=1.0)
        self.assertEqual(scores["labour"], 0.5)

    def test_malformed_input_raises_value_error(self):
        for bad in ([], "x", {"features": []}, {"weights": [1]}, {"constraints": "no"}, {"farmer_context": {"rotation_history": "x"}},
                    {"farmer_context": {"available_crops": "cowpea"}}, {"constraints": {"seed_access": ["x"]}}):
            with self.assertRaises(ValueError, msg=str(bad)):
                validate_request(bad)

    def test_no_numpy_or_pandas_in_the_engine(self):
        import pathlib
        for path in pathlib.Path("engine").glob("*.py"):
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("import numpy", text)
            self.assertNotIn("import pandas", text)


if __name__ == "__main__":
    unittest.main()

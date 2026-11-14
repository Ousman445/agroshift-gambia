import copy
import unittest

from app.strategy_engine import recommend_strategies
from engine.confidence import assess_confidence, trait_support
from engine.knowledge_base import KnowledgeBase, load_kb

KB = load_kb()


class ConfidenceTests(unittest.TestCase):
    def test_pilot_confidence_is_never_high(self):
        r = recommend_strategies({"farmer_context": {"available_crops": ["cowpea", "millet"], "cash_available": "medium", "labour": "can_hire",
                                                       "priorities": {"food": 1}, "rotation_history": [{"crop": "groundnut"}]},
                                  "evidence_base": {"agronomist_reviewed": True, "farmers_interviewed": 10}})
        for s in r["strategies"]:
            self.assertNotEqual(s["confidence"], "high")

    def test_untested_alternatives_are_low_confidence(self):
        r = recommend_strategies({"field_id": "x"})
        for s in r["strategies"]:
            self.assertEqual(s["confidence"], "low")
            self.assertTrue(s["confidence_detail"]["reasons"])
            self.assertIn("capped at moderate", s["confidence_detail"]["reasons"][-1])

    def test_unconfirmed_crops_are_named_in_the_reasons(self):
        r = recommend_strategies({})
        b = next(s for s in r["strategies"] if s["id"] == "B")
        self.assertTrue(any("cowpea" in reason for reason in b["confidence_detail"]["reasons"]))

    def test_trait_support_share_counts_unsourced_traits(self):
        share, weak = trait_support(["cowpea"], KB)
        self.assertLess(share, 1.0)
        self.assertTrue(any("water requirement" in w for w in weak))

    def test_high_needs_review_farmers_sources_and_complete_inputs(self):
        data = copy.deepcopy(KB.data)
        for crop in data["crops"].values():
            for name, trait in crop.items():
                if not name.startswith("_") and trait["trait_status"] in ("assumption", "unknown"):
                    trait["trait_status"] = "sourced_local"; trait["source_ids"] = ["VISIT-01"]
        well_sourced = KnowledgeBase(data)
        base = {"farmers_interviewed": 5, "agronomist_reviewed": True}
        high, _ = assess_confidence(["groundnut", "maize"], well_sourced, base, [], 0)
        self.assertEqual(high["level"], "high")
        for change in ({"agronomist_reviewed": False}, {"farmers_interviewed": 2}):
            level, _ = assess_confidence(["groundnut", "maize"], well_sourced, {**base, **change}, [], 0)
            self.assertNotEqual(level["level"], "high")
        self.assertNotEqual(assess_confidence(["groundnut", "maize"], well_sourced, base, ["cowpea"], 0)[0]["level"], "high")
        self.assertNotEqual(assess_confidence(["groundnut", "maize"], well_sourced, base, [], 2)[0]["level"], "high")

    def test_many_missing_inputs_lower_confidence(self):
        level, _ = assess_confidence(["groundnut", "maize"], KB, {"farmers_interviewed": 5}, [], 4, is_reference=True)
        self.assertEqual(level["level"], "low")

    def test_score_ranges_widen_with_uncertain_traits(self):
        r = recommend_strategies({})
        a = next(s for s in r["strategies"] if s["id"] == "A")
        self.assertLess(a["score_range"][0], a["score"] + 1e-9)
        self.assertGreater(a["score_range"][1], a["score"] - 1e-9)
        self.assertGreater(a["score_range"][1] - a["score_range"][0], 0)


if __name__ == "__main__":
    unittest.main()

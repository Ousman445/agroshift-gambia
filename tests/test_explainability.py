import unittest

from app.strategy_engine import recommend_strategies


class ExplainabilityTests(unittest.TestCase):
    def setUp(self):
        self.r = recommend_strategies({"field_id": "x", "farmer_context": {"rotation_history": [{"crop": "groundnut"}, {"crop": "groundnut"}, {"crop": "groundnut"}]}})

    def test_five_criteria_with_weights_and_weighted_points(self):
        for s in self.r["strategies"]:
            self.assertEqual([c["name"] for c in s["criteria"]], ["water", "soil_health", "food", "income", "labour"])
            total = sum(c["weighted_points"] for c in s["criteria"])
            self.assertAlmostEqual(total, s["score"], delta=0.6)
            self.assertAlmostEqual(sum(c["weight"] for c in s["criteria"]), 1.0, places=3)
            for c in s["criteria"]:
                self.assertTrue(c["reason"])
                self.assertTrue(0 <= c["score"] <= 100)

    def test_evidence_is_labelled_by_type(self):
        allowed = {"farmer_report", "published_source", "satellite_derived", "assumption"}
        classes = set()
        for s in self.r["strategies"]:
            self.assertEqual(len(s["evidence"]), len(s["evidence_items"]))
            for item in s["evidence_items"]:
                self.assertIn(item["evidence_class"], allowed)
                classes.add(item["evidence_class"])
                if item["evidence_class"] == "published_source":
                    self.assertTrue(item["source_ids"])
            self.assertTrue(all(any(tag in e for tag in ("FARMER REPORT", "PUBLISHED SOURCE", "SATELLITE DERIVED", "ASSUMPTION")) for e in s["evidence"]))
        self.assertTrue({"farmer_report", "published_source", "satellite_derived"} <= classes)

    def test_unsourced_traits_are_listed_as_gaps_and_flagged_in_criteria(self):
        a = next(s for s in self.r["strategies"] if s["id"] == "A")
        self.assertTrue(any(g.startswith("Crop traits without a source") for g in a["gaps"]))
        self.assertTrue(any("no source" in c["reason"] for c in a["criteria"]))

    def test_dry_spell_threshold_is_declared_unverified_and_tested(self):
        text = " ".join(self.r["assumptions"])
        self.assertIn("unverified", text)
        self.assertIn("5 mm", text)
        self.assertIn("MERRA-2 cannot resolve dry spells", text)
        self.assertEqual(self.r["climate_evidence"]["dry_spells"]["merra2"]["status"], "not_used")
        self.assertIn("exposure_by_threshold", self.r["climate_evidence"]["dry_spells"])

    def test_climate_and_modis_evidence_is_not_overstated(self):
        c = self.r["climate_evidence"]
        self.assertIn("not the field itself", c["note"])
        self.assertEqual(c["ndvi_context"]["quality_rule"], "reliability_0_only")
        self.assertEqual(c["ndvi_context"]["no_reliable_view_months"], [7, 8, 9])

    def test_no_output_claims_yield_or_probability_or_exact_coordinates(self):
        import json
        text = json.dumps(self.r).lower()
        for banned in ("will increase yield", "guaranteed yield", "guaranteed to", "will raise income", "latitude", "longitude"):
            self.assertNotIn(banned, text)
        self.assertIn("not probabilities or yield predictions", " ".join(self.r["assumptions"]))

    def test_headline_admits_when_the_advantage_is_not_clear(self):
        text = self.r["suggestion"]["text"]
        self.assertIn("does not show a clear advantage", text)

    def test_current_rotation_repetition_is_explained(self):
        ref = self.r["reference_rotation"]
        self.assertTrue(any("monoculture" in e for e in ref["evidence"]))

    def test_cowpea_option_states_its_optimistic_assumptions_as_assumptions(self):
        b = next(s for s in self.r["strategies"] if s["id"] == "B")
        text = " ".join(b["trade_offs"] + b["risks_for_local_review"])
        self.assertIn("10-20%", text)
        self.assertIn("assumption", text)

    def test_status_notes_distinguish_ready_from_conditional(self):
        notes = {s["id"]: s["status_note"] for s in self.r["strategies"]}
        self.assertTrue(notes["A"].startswith("Ready"))
        self.assertTrue(notes["B"].startswith("Conditional"))


if __name__ == "__main__":
    unittest.main()

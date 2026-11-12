import copy
import unittest

from engine.knowledge_base import SUPPORTED, KnowledgeBase, load_kb, validate_kb


class KnowledgeBaseTests(unittest.TestCase):
    def setUp(self):
        self.kb = load_kb()

    def test_shipped_knowledge_base_is_valid(self):
        self.assertEqual(validate_kb(self.kb.data), [])

    def test_every_supported_trait_has_existing_sources(self):
        for crop, traits in self.kb.crops.items():
            for name, trait in traits.items():
                if name.startswith("_"):
                    continue
                if trait["trait_status"] in SUPPORTED:
                    self.assertTrue(trait["source_ids"], f"{crop}.{name}")
                    for sid in trait["source_ids"]:
                        self.assertIn(sid, self.kb.sources)

    def test_supported_trait_without_source_is_rejected(self):
        data = copy.deepcopy(self.kb.data)
        data["crops"]["maize"]["input_cost"]["source_ids"] = []
        self.assertTrue(any("maize.input_cost" in e for e in validate_kb(data)))
        with self.assertRaises(ValueError):
            KnowledgeBase(data)

    def test_unknown_source_id_and_bad_status_are_rejected(self):
        data = copy.deepcopy(self.kb.data)
        data["crops"]["maize"]["labour_demand"]["source_ids"] = ["NOPE"]
        data["crops"]["maize"]["market_access"]["trait_status"] = "verified"
        errors = validate_kb(data)
        self.assertTrue(any("unknown source id" in e for e in errors))
        self.assertTrue(any("invalid trait_status" in e for e in errors))

    def test_only_groundnut_and_maize_are_locally_confirmed(self):
        confirmed = {c for c in self.kb.crops if self.kb.locally_confirmed(c)}
        self.assertEqual(confirmed, {"groundnut", "maize"})

    def test_cowpea_assumptions_are_conservative(self):
        # optimistic cowpea values from the prototype were removed or marked as assumptions
        self.assertEqual(self.kb.trait("cowpea", "water_requirement")["trait_status"], "unknown")
        self.assertEqual(self.kb.trait("cowpea", "labour_demand")["trait_status"], "unknown")
        self.assertNotEqual(self.kb.value("cowpea", "ground_cover_erosion"), "high")
        credit = self.kb.trait("cowpea", "n_credit")
        self.assertEqual(credit["trait_status"], "assumption")
        self.assertLess(credit["value"], self.kb.value("groundnut", "n_credit"))

    def test_farmer_reports_cite_the_field_visit(self):
        for crop, traits in self.kb.crops.items():
            for name, trait in traits.items():
                if not name.startswith("_") and trait["trait_status"] == "farmer_reported":
                    self.assertIn("VISIT-01", trait["source_ids"], f"{crop}.{name}")


if __name__ == "__main__":
    unittest.main()

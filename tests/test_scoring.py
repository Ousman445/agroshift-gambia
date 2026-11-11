import unittest

from engine import rules as R
from engine.knowledge_base import load_kb
from engine.scoring import calculate_weighted_score, crop_scores, resolve_weights, sensitivity_range, sequence_scores, suitability_index

KB = load_kb()


class WeightTests(unittest.TestCase):
    def test_defaults_are_the_five_priorities_and_sum_to_one(self):
        requested, weights, source, warnings = resolve_weights({}, {})
        self.assertEqual(set(weights), set(R.CRITERIA))
        self.assertAlmostEqual(sum(weights.values()), 1.0, places=9)
        self.assertEqual(source, "pilot_default")
        self.assertEqual(warnings, [])

    def test_custom_weights_are_normalised(self):
        _, weights, source, _ = resolve_weights({"water": 3, "soil_health": 1, "food": 0, "income": 0, "labour": 0}, {})
        self.assertAlmostEqual(weights["water"], 0.75)
        self.assertAlmostEqual(weights["soil_health"], 0.25)
        self.assertEqual(source, "request_weights")

    def test_legacy_six_criterion_names_map_to_five_priorities(self):
        requested, _, _, _ = resolve_weights({"soil_fertility": 1, "erosion_management": 1, "food_security": 2}, {})
        self.assertEqual(requested["soil_health"], 2)   # two legacy soil criteria merge
        self.assertEqual(requested["food"], 2)

    def test_invalid_entries_are_ignored_with_a_warning(self):
        requested, _, _, warnings = resolve_weights({"water": -1, "income": "lots", "dragons": 5, "food": True}, {})
        self.assertEqual(requested, R.DEFAULT_REQUESTED)
        self.assertEqual(len(warnings), 4)

    def test_all_zero_weights_fall_back_to_defaults(self):
        requested, weights, _, warnings = resolve_weights({k: 0 for k in R.CRITERIA}, {})
        self.assertEqual(requested, R.DEFAULT_REQUESTED)
        self.assertTrue(any("zero" in w for w in warnings))
        self.assertAlmostEqual(sum(weights.values()), 1.0)

    def test_farmer_priorities_are_a_complete_selection(self):
        _, weights, source, _ = resolve_weights({}, {"food": 1, "income": 1})
        self.assertEqual(source, "farmer_priorities")
        self.assertAlmostEqual(weights["food"], 0.5)
        self.assertEqual(weights["water"], 0.0)

    def test_weights_change_the_ranking(self):
        exp = 0.273
        water_only = {k: (1.0 if k == "water" else 0.0) for k in R.CRITERIA}
        labour_only = {k: (1.0 if k == "labour" else 0.0) for k in R.CRITERIA}
        millet = sequence_scores(KB, ["millet", "groundnut"], exp, False, 1.0)["criterion_scores"]
        maize = sequence_scores(KB, ["groundnut", "maize"], exp, False, 1.0)["criterion_scores"]
        self.assertGreater(suitability_index(millet, water_only), suitability_index(maize, water_only))
        self.assertNotEqual(suitability_index(millet, water_only), suitability_index(millet, labour_only))

    def test_legacy_weighted_score_helper_still_works(self):
        self.assertEqual(calculate_weighted_score({"a": 80, "b": None}, {"a": 1, "b": 1}), 80)


class CropScoringTests(unittest.TestCase):
    def test_scores_stay_between_zero_and_one(self):
        for crop in KB.crops:
            for neutral in (False, True):
                for value in crop_scores(KB, crop, 0.73, neutral, 1.0).values():
                    self.assertTrue(0.0 <= value <= 1.0)

    def test_unknown_traits_score_neutral_not_good_or_bad(self):
        # cowpea water requirement and labour are unknown in the knowledge base
        self.assertEqual(KB.value("cowpea", "water_requirement"), "unknown")
        with_unknown = crop_scores(KB, "cowpea", 0.0, False, 1.0)
        self.assertEqual(with_unknown["labour"], R.NEUTRAL)

    def test_dry_spell_exposure_hurts_drought_sensitive_crops_more(self):
        maize_drop = crop_scores(KB, "maize", 0.0)["water"] - crop_scores(KB, "maize", 0.7)["water"]
        millet_drop = crop_scores(KB, "millet", 0.0, shrink=1.0)["water"] - crop_scores(KB, "millet", 0.7, shrink=1.0)["water"]
        self.assertGreater(maize_drop, millet_drop)

    def test_novelty_discount_applies_only_to_unconfirmed_crops(self):
        full = crop_scores(KB, "cowpea", 0.27, shrink=1.0)
        shrunk = crop_scores(KB, "cowpea", 0.27, shrink=R.NOVELTY_SHRINK)
        for key in full:
            self.assertLessEqual(abs(shrunk[key] - 0.5), abs(full[key] - 0.5) + 1e-9)
        self.assertEqual(crop_scores(KB, "maize", 0.27, shrink=1.0), crop_scores(KB, "maize", 0.27, shrink=R.NOVELTY_SHRINK))

    def test_cowpea_nitrogen_credit_is_smaller_than_groundnut(self):
        g = crop_scores(KB, "groundnut", 0.27)["nitrogen"]
        c = crop_scores(KB, "cowpea", 0.27, shrink=1.0)["nitrogen"]
        self.assertGreater(g, c)


class RotationScoringTests(unittest.TestCase):
    def test_repeating_a_crop_lowers_income_and_nitrogen_adjustments(self):
        repeat = sequence_scores(KB, ["groundnut", "groundnut", "groundnut"], 0.27)
        mixed = sequence_scores(KB, ["groundnut", "groundnut", "maize"], 0.27)
        self.assertEqual(repeat["rotation_effects"]["repeat_transitions"], 3)
        self.assertEqual(mixed["rotation_effects"]["legume_to_cereal_transitions"], 1)
        single = crop_scores(KB, "groundnut", 0.27)
        self.assertLess(repeat["criterion_scores"]["income"], single["income"])

    def test_legume_then_cereal_adds_a_nitrogen_credit(self):
        alternating = sequence_scores(KB, ["groundnut", "maize"], 0.27)
        no_bonus = (crop_scores(KB, "groundnut", 0.27)["nitrogen"] + crop_scores(KB, "maize", 0.27)["nitrogen"]) / 2
        self.assertGreater(alternating["soil_health_components"]["nitrogen"], no_bonus)

    def test_sensitivity_range_brackets_the_primary_index(self):
        weights = resolve_weights({}, {})[1]
        for cycle in (["groundnut", "maize"], ["maize", "cowpea"], ["millet", "groundnut"]):
            lo, hi = sensitivity_range(KB, cycle, weights, [0.0, 0.273, 0.727])
            idx = suitability_index(sequence_scores(KB, cycle, 0.273, False, R.NOVELTY_SHRINK)["criterion_scores"], weights)
            self.assertLessEqual(lo, idx + 1e-9)
            self.assertGreaterEqual(hi, idx - 1e-9)
            self.assertTrue(0 <= lo <= hi <= 100)


if __name__ == "__main__":
    unittest.main()

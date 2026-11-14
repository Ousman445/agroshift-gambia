import unittest

from app.strategy_engine import recommend_strategies
from engine.feasibility import assess, choose_cycle, seed_state
from engine.knowledge_base import load_kb
from engine import rules as R

KB = load_kb()


def strat(result, sid):
    return next(s for s in result["strategies"] if s["id"] == sid)


class SeedAvailabilityTests(unittest.TestCase):
    def test_locally_grown_crops_are_available_by_default(self):
        self.assertEqual(seed_state("groundnut", {}, {}, KB), "available")
        self.assertEqual(seed_state("maize", {}, {}, KB), "available")

    def test_new_crops_are_unknown_until_confirmed(self):
        for crop in ("cowpea", "millet", "sorghum"):
            self.assertEqual(seed_state(crop, {}, {}, KB), "unknown")

    def test_farmer_confirmation_in_either_format_makes_a_crop_available(self):
        self.assertEqual(seed_state("cowpea", {"available_crops": ["Cowpea"]}, {}, KB), "available")
        self.assertEqual(seed_state("cowpea", {"seed_available": ["cowpea"]}, {}, KB), "available")
        self.assertEqual(seed_state("cowpea", {}, {"seed_access": {"cowpea": "easy"}}, KB), "available")

    def test_explicit_unavailable_report_beats_local_confirmation(self):
        self.assertEqual(seed_state("groundnut", {}, {"seed_access": {"groundnut": "unavailable"}}, KB), "unavailable")
        self.assertEqual(seed_state("maize", {"unavailable_crops": ["maize"]}, {}, KB), "unavailable")

    def test_limited_seed_is_conditional_not_ready(self):
        self.assertEqual(seed_state("cowpea", {}, {"seed_access": {"cowpea": "limited"}}, KB), "limited")
        r = recommend_strategies({"constraints": {"seed_access": {"cowpea": "limited"}}, "farmer_context": {"available_crops": []}})
        self.assertEqual(strat(r, "B")["recommendation_status"], "conditional_candidate")

    def test_alternative_crop_slot_prefers_available_seed(self):
        cycle = choose_cycle([["millet", "sorghum"], ["groundnut"]], {"available_crops": ["sorghum"]}, {}, KB)
        self.assertEqual(cycle, ["sorghum", "groundnut"])
        cycle = choose_cycle([["millet", "sorghum"], ["groundnut"]], {"unavailable_crops": ["millet"]}, {}, KB)
        self.assertEqual(cycle[0], "sorghum")


class FeasibilityStatusTests(unittest.TestCase):
    def test_default_pilot_state(self):
        r = recommend_strategies({"field_id": "x"})
        self.assertEqual(strat(r, "A")["recommendation_status"], "feasible_candidate")
        self.assertEqual(strat(r, "B")["recommendation_status"], "conditional_candidate")
        self.assertEqual(strat(r, "C")["recommendation_status"], "conditional_candidate")

    def test_unavailable_crop_blocks_every_strategy_that_uses_it(self):
        r = recommend_strategies({"constraints": {"seed_access": {"groundnut": "none"}}})
        for sid in ("A", "C"):
            s = strat(r, sid)
            self.assertEqual(s["recommendation_status"], "not_recommended")
            self.assertIsNone(s["score"])
            self.assertIsNone(s["score_range"])
            self.assertEqual(s["criteria"], [])
            self.assertIn("groundnut", s["constraints"]["unavailable_crops"])
            self.assertTrue(s["constraints"]["would_become_feasible_if"])
        self.assertNotEqual(strat(r, "B")["recommendation_status"], "not_recommended")

    def test_confirming_seed_makes_a_candidate_ready(self):
        r = recommend_strategies({"farmer_context": {"available_crops": ["cowpea"]}})
        self.assertEqual(strat(r, "B")["recommendation_status"], "feasible_candidate")

    def test_no_money_blocks_high_input_crops_only(self):
        r = recommend_strategies({"constraints": {"budget_available": False}, "farmer_context": {"available_crops": ["cowpea", "millet"]}})
        self.assertEqual(strat(r, "A")["recommendation_status"], "not_recommended")   # maize needs costly inputs
        self.assertEqual(strat(r, "B")["recommendation_status"], "not_recommended")
        self.assertNotEqual(strat(r, "C")["recommendation_status"], "not_recommended")   # millet and groundnut are not high-input

    def test_low_budget_is_a_condition_and_makes_the_option_conditional(self):
        r = recommend_strategies({"farmer_context": {"cash_available": "low"}})
        a = strat(r, "A")
        self.assertEqual(a["recommendation_status"], "conditional_candidate")
        self.assertTrue(any("Budget is low" in c for c in a["constraints"]["conditions"]))

    def test_unknown_budget_and_labour_are_gaps_not_failures(self):
        r = recommend_strategies({"field_id": "x"})
        a = strat(r, "A")
        self.assertEqual(a["constraints"]["failures"], [])
        self.assertTrue(any("budget not recorded" in g.lower() for g in a["gaps"]))
        self.assertTrue(any("labour availability not recorded" in g.lower() for g in a["gaps"]))

    def test_insufficient_labour_blocks_labour_heavy_sequences(self):
        heavy = assess(["millet", "groundnut"], R.STRATEGIES[2], {}, {"labour_available": False}, KB)
        self.assertEqual(heavy["status"], "not_recommended")
        light = assess(["maize", "cowpea"], R.STRATEGIES[1], {"available_crops": ["cowpea"]}, {"labour_available": False}, KB)
        self.assertNotEqual(light["status"], "feasible_candidate")   # limited labour is at least a condition

    def test_family_labour_only_is_a_condition_for_heavy_sequences(self):
        f = assess(["millet", "groundnut"], R.STRATEGIES[2], {"labour": "family_only", "available_crops": ["millet"]}, {}, KB)
        self.assertEqual(f["status"], "conditional_candidate")


class CoverCropTests(unittest.TestCase):
    def test_cover_crop_is_not_evaluated_and_adds_no_misleading_condition(self):
        r = recommend_strategies({"constraints": {"dry_season_water": "none", "post_harvest_grazing": True}})
        self.assertTrue(any("cover crop" in n.lower() for n in r["not_evaluated"]))
        for s in r["strategies"]:
            for text in s["constraints"]["conditions"] + s["constraints"]["failures"]:
                self.assertNotIn("cover", text.lower())
        # option A has no open condition in the default pilot state, so it is ready, not conditional
        self.assertEqual(strat(r, "A")["recommendation_status"], "feasible_candidate")

    def test_a_cover_crop_strategy_would_be_infeasible_without_water_or_grazing_management(self):
        tpl = dict(R.STRATEGIES[0], cover_crop=True)
        res = assess(["groundnut", "maize"], tpl, {}, {"dry_season_water": "none", "post_harvest_grazing": True}, KB)
        self.assertEqual(res["status"], "not_recommended")
        self.assertEqual(sum("cover crop" in f.lower() for f in res["failures"]), 1)
        self.assertTrue(any("grazing" in f.lower() for f in res["failures"]))


class ReadinessTests(unittest.TestCase):
    def test_conditional_options_never_outrank_ready_options_or_become_the_headline(self):
        r = recommend_strategies({"farmer_context": {"rotation_history": [{"crop": "groundnut"}, {"crop": "groundnut"}, {"crop": "maize"}]}})
        statuses = [s["recommendation_status"] for s in r["strategies"]]
        self.assertEqual(statuses, sorted(statuses, key=lambda x: {"feasible_candidate": 0, "conditional_candidate": 1, "not_recommended": 2}[x]))
        self.assertEqual(r["suggestion"]["ready_option"], "A")
        self.assertIn("not ready until their conditions are confirmed", r["suggestion"]["text"])
        self.assertTrue(r["suggestion"]["conditional_options"])

    def test_no_ready_option_is_stated_plainly(self):
        r = recommend_strategies({"constraints": {"seed_access": {"groundnut": "unavailable"}}})
        self.assertIsNone(r["suggestion"]["ready_option"])
        self.assertIn("No option is ready", r["suggestion"]["text"])


if __name__ == "__main__":
    unittest.main()

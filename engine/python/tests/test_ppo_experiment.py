from __future__ import annotations

import unittest

from football_env.ppo_experiment import (
    GENERALIZATION_SCENARIOS,
    TRAINING_SCENARIOS,
    EpisodeResult,
    build_evaluation_report,
)


class PpoExperimentTest(unittest.TestCase):
    def test_training_and_generalization_scenarios_are_disjoint(self) -> None:
        training = {(item.attacker_distance, item.attacker_lateral_offset) for item in TRAINING_SCENARIOS}
        generalization = {(item.attacker_distance, item.attacker_lateral_offset) for item in GENERALIZATION_SCENARIOS}
        self.assertFalse(training.intersection(generalization))
        self.assertTrue(all(item.protocol_options()["scenario"]["freezeGoalkeeper"] for item in TRAINING_SCENARIOS + GENERALIZATION_SCENARIOS))

    def test_report_publishes_explicit_ppo_deltas_and_generalization_gap(self) -> None:
        records = []
        for partition in ("IN_DISTRIBUTION", "GENERALIZATION"):
            records.extend([
                EpisodeResult("PPO_V1", partition, "scenario", 1, "GOAL", 0.99, 1, True, False),
                EpisodeResult("RANDOM_VALID", partition, "scenario", 1, "OFF_TARGET", -0.21, 1, True, False),
            ])
        report = build_evaluation_report(records)
        self.assertEqual(len(report["ppoComparisons"]), 2)
        self.assertTrue(all(item["goalRateDelta"] == 1 for item in report["ppoComparisons"]))
        self.assertEqual(report["ppoGeneralizationGap"], {"goalRate": 0, "return": 0})


if __name__ == "__main__":
    unittest.main()

import unittest

from football_env.statistical_gates import mean_confidence_interval, paired_difference_interval


class StatisticalGatesTest(unittest.TestCase):
    def test_mean_interval_contains_estimate_and_shrinks_for_constant_samples(self) -> None:
        interval = mean_confidence_interval([1.0] * 20)
        self.assertEqual(1.0, interval["lower"])
        self.assertEqual(1.0, interval["upper"])
        self.assertEqual(20, interval["samples"])

    def test_paired_gate_uses_seed_aligned_differences(self) -> None:
        interval = paired_difference_interval([1.2, 1.4, 1.6, 1.8], [1.0, 1.2, 1.4, 1.6])
        self.assertGreater(interval["lower"], 0)


if __name__ == "__main__":
    unittest.main()

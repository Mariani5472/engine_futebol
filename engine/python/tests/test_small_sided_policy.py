from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np

from football_env.env import ACTION_COUNT, OBSERVATION_SIZE
from football_env.small_sided_policy import PolicyTransition, SharedMaskedLinearPolicy


class SmallSidedPolicyTest(unittest.TestCase):
    def test_respects_mask_updates_and_round_trips_checkpoint(self) -> None:
        policy = SharedMaskedLinearPolicy(7)
        observation = np.ones(OBSERVATION_SIZE, dtype=np.float32)
        mask = np.zeros(ACTION_COUNT, dtype=np.int8)
        mask[[1, 3]] = 1
        action = policy.act(observation, mask, stochastic=False, random=np.random.default_rng(7))
        self.assertIn(action, (1, 3))
        before = policy.weights.copy()
        policy.update([PolicyTransition("home-1", observation, mask, action, 1.0),
                       PolicyTransition("home-1", observation * .5, mask, action, 0.0)])
        self.assertFalse(np.array_equal(before, policy.weights))
        self.assertGreater(np.linalg.norm(policy.value_weights), 0)
        with TemporaryDirectory() as directory:
            path = policy.save(Path(directory) / "policy.npz", {"stage": "FIVE_V_FIVE"})
            restored = SharedMaskedLinearPolicy.load(path)
            np.testing.assert_allclose(policy.weights, restored.weights)
            np.testing.assert_allclose(policy.value_weights, restored.value_weights)

    def test_temporal_credit_is_calculated_per_agent(self) -> None:
        policy = SharedMaskedLinearPolicy(11)
        observation = np.ones(OBSERVATION_SIZE, dtype=np.float32)
        mask = np.zeros(ACTION_COUNT, dtype=np.int8)
        mask[[1, 3]] = 1
        before = policy.weights.copy()
        transitions = [
            PolicyTransition("home-1", observation, mask, 1, 0.0),
            PolicyTransition("away-1", observation, mask, 3, -1.0),
            PolicyTransition("home-1", observation, mask, 1, 1.0),
        ]
        policy.update(transitions)
        home_delta = float(np.sum(policy.weights[1] - before[1]))
        away_delta = float(np.sum(policy.weights[3] - before[3]))
        self.assertGreater(home_delta, away_delta)

    def test_constant_sparse_advantage_still_updates_actor(self) -> None:
        policy = SharedMaskedLinearPolicy(13)
        observation = np.ones(OBSERVATION_SIZE, dtype=np.float32)
        mask = np.zeros(ACTION_COUNT, dtype=np.int8)
        mask[[1, 3]] = 1
        before = policy.weights.copy()
        policy.update([PolicyTransition("home-1", observation, mask, 1, 1.0)])
        self.assertGreater(float(np.linalg.norm(policy.weights - before)), 0)


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import unittest

import numpy as np

from football_env.fundamental_ppo import FundamentalPpoEpisodeRunner, curriculum_phases


class FakeModel:
    def predict(self, _observation, *, action_masks, deterministic):
        assert deterministic
        return int(np.flatnonzero(action_masks)[0]), None


class FakeEnvironment:
    def __init__(self) -> None:
        self.closed = False
        self.resets: list[int] = []

    def reset(self, *, seed: int):
        self.resets.append(seed)
        return np.zeros(189), {"action_mask": np.array([1] + [0] * 23)}

    def step(self, _action: int):
        return np.zeros(189), 1.0, True, False, {
            "action_mask": np.array([1] + [0] * 23),
            "outcome": "TARGET_REACHED",
            "transition": {"physicalTicks": 7},
        }

    def close(self) -> None:
        self.closed = True


class FundamentalPpoTest(unittest.TestCase):
    def test_phases_preserve_exact_timestep_budget(self) -> None:
        phases = curriculum_phases(10)
        self.assertEqual(sum(phase.timesteps for phase in phases), 10)
        self.assertEqual([phase.difficulty_level for phase in phases], [0.15, 0.35, 0.6])

    def test_advanced_skills_rehearse_previous_levels_and_reach_generalization(self) -> None:
        phases = curriculum_phases(20, "BALL_CONTROL")
        self.assertEqual(phases[-1].difficulty_level, 1.0)
        self.assertEqual(phases[-1].rehearsal_levels, (0.1, 0.25, 0.45, 0.7))

    def test_runner_reuses_environment_and_returns_semantic_evidence(self) -> None:
        created: list[FakeEnvironment] = []

        def factory(_skill: str, _seed: int, _level: float):
            environment = FakeEnvironment()
            created.append(environment)
            return environment

        runner = FundamentalPpoEpisodeRunner(FakeModel(), engine_dir=".", environment_factory=factory)
        first = runner("MOVEMENT", "EVALUATION", 11, 0.6)
        second = runner("MOVEMENT", "EVALUATION", 12, 0.6)
        self.assertTrue(first.success and second.success)
        self.assertEqual(first.physical_ticks, 7)
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0].resets, [11, 12])
        runner.close()
        self.assertTrue(created[0].closed)


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

import numpy as np
from sb3_contrib import MaskablePPO

from .curriculum_manager import FundamentalEpisodeEvidence
from .fundamental_env import FundamentalSkillEnv


@dataclass(frozen=True)
class CurriculumPhase:
    difficulty_level: float
    timesteps: int
    rehearsal_levels: tuple[float, ...] = ()


def curriculum_phases(total_timesteps: int, skill: str = "MOVEMENT") -> tuple[CurriculumPhase, ...]:
    if total_timesteps <= 0:
        raise ValueError("total_timesteps must be positive")
    levels_by_skill = {
        "MOVEMENT": (0.15, 0.35, 0.6),
        "BALL_CONTROL": (0.1, 0.25, 0.45, 0.7, 1.0),
        "PASSING": (0.1, 0.3, 0.6, 1.0),
        "SHOOTING_EMPTY_GOAL": (0.1, 0.25, 0.45, 0.7, 1.0),
    }
    if skill not in levels_by_skill:
        raise ValueError(f"Unknown fundamental skill: {skill}")
    levels = levels_by_skill[skill]
    base, remainder = divmod(total_timesteps, len(levels))
    return tuple(CurriculumPhase(
        level,
        base + (1 if index < remainder else 0),
        tuple(levels[:index]),
    ) for index, level in enumerate(levels))


def train_fundamental_ppo(
    *,
    skill: str,
    training_seeds: Sequence[int],
    total_timesteps: int,
    root_seed: int,
    engine_dir: str | Path,
    command: Sequence[str] | None = None,
) -> MaskablePPO:
    if not training_seeds:
        raise ValueError("training_seeds must not be empty")
    model: MaskablePPO | None = None
    for phase in curriculum_phases(total_timesteps, skill):
        with FundamentalSkillEnv(
            skill,
            engine_dir=engine_dir,
            command=command,
            seed=int(training_seeds[0]),
            episode_seeds=training_seeds,
            environment_options={
                "difficultyLevel": phase.difficulty_level,
                "rehearsalLevels": phase.rehearsal_levels,
                "rehearsalRate": 0.25 if phase.rehearsal_levels else 0,
            },
        ) as environment:
            if model is None:
                model = MaskablePPO(
                    "MlpPolicy", environment, seed=root_seed, verbose=1,
                    n_steps=256, batch_size=64, learning_rate=3e-4,
                    gamma=0.99, gae_lambda=0.95, ent_coef=0.01,
                    policy_kwargs={"net_arch": [128, 128]},
                )
            else:
                model.set_env(environment)
            model.learn(total_timesteps=phase.timesteps, reset_num_timesteps=False)
    assert model is not None
    return model


EnvironmentFactory = Callable[[str, int, float], FundamentalSkillEnv]


class FundamentalPpoEpisodeRunner:
    """Evaluates one checkpoint against authoritative seeds with persistent environments."""

    def __init__(
        self,
        model: Any,
        *,
        engine_dir: str | Path,
        command: Sequence[str] | None = None,
        environment_factory: EnvironmentFactory | None = None,
    ) -> None:
        self.model = model
        self.engine_dir = Path(engine_dir)
        self.command = command
        self.environment_factory = environment_factory or self._create_environment
        self._environments: dict[tuple[str, float], FundamentalSkillEnv] = {}

    def __call__(self, skill: str, partition: str, seed: int, level: float) -> FundamentalEpisodeEvidence:
        del partition
        key = (skill, level)
        environment = self._environments.get(key)
        if environment is None:
            environment = self.environment_factory(skill, seed, level)
            self._environments[key] = environment
        observation, info = environment.reset(seed=seed)
        episode_return = 0.0
        decisions = 0
        physical_ticks = 0
        terminated = truncated = False
        while not (terminated or truncated):
            action, _ = self.model.predict(
                observation,
                action_masks=np.asarray(info["action_mask"], dtype=bool),
                deterministic=True,
            )
            observation, reward, terminated, truncated, info = environment.step(int(action))
            episode_return += float(reward)
            decisions += 1
            transition = info.get("transition") or {}
            physical_ticks += int(transition.get("physicalTicks", 0))
        outcome = str(info.get("outcome") or "TIMEOUT")
        return FundamentalEpisodeEvidence(
            success=_is_success(skill, outcome),
            episode_return=episode_return,
            outcome=outcome,
            decisions=decisions,
            physical_ticks=physical_ticks,
        )

    def close(self) -> None:
        for environment in self._environments.values():
            environment.close()
        self._environments.clear()

    def _create_environment(self, skill: str, seed: int, level: float) -> FundamentalSkillEnv:
        return FundamentalSkillEnv(
            skill,
            engine_dir=self.engine_dir,
            command=self.command,
            seed=seed,
            environment_options={"difficultyLevel": level},
        )

    def __enter__(self) -> "FundamentalPpoEpisodeRunner":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _is_success(skill: str, outcome: str) -> bool:
    expected = {
        "MOVEMENT": "TARGET_REACHED",
        "BALL_CONTROL": "BALL_CONTROLLED",
        "PASSING": "PASS_COMPLETED",
        "SHOOTING_EMPTY_GOAL": "GOAL",
    }
    return outcome == expected[skill]

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Sequence

from .env import AttackerVsGoalkeeperEnv

FUNDAMENTAL_SKILLS = (
    "MOVEMENT",
    "BALL_CONTROL",
    "PASSING",
    "SHOOTING_EMPTY_GOAL",
)


class FundamentalSkillEnv(AttackerVsGoalkeeperEnv):
    """Gymnasium environment for one authoritative individual-skill scenario."""

    def __init__(
        self,
        skill: str,
        *,
        command: Sequence[str] | None = None,
        engine_dir: str | Path | None = None,
        seed: int = 1,
        timeout_seconds: float = 30.0,
        environment_options: Mapping[str, Any] | None = None,
        episode_seeds: Sequence[int] | None = None,
        wire_format: str = "COMPACT",
    ) -> None:
        if skill not in FUNDAMENTAL_SKILLS:
            raise ValueError(f"Unknown fundamental skill: {skill}")
        self.skill = skill
        super().__init__(
            command=command,
            engine_dir=engine_dir,
            seed=seed,
            timeout_seconds=timeout_seconds,
            environment_options=environment_options,
            episode_seeds=episode_seeds,
            wire_format=wire_format,
            _environment_kind="FUNDAMENTAL",
            _environment_payload={"skill": skill},
        )

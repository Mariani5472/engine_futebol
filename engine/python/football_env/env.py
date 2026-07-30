from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any, Mapping, Sequence

import gymnasium as gym
import numpy as np

from .client import PROTOCOL_VERSION, ProtocolError, TrainingProcessClient

OBSERVATION_SIZE = 189
ACTION_COUNT = 24


class AttackerVsGoalkeeperEnv(gym.Env[np.ndarray, int]):
    """Gymnasium wrapper for the versioned TypeScript 1v1 environment."""

    metadata = {"render_modes": []}

    def __init__(
        self,
        *,
        command: Sequence[str] | None = None,
        engine_dir: str | Path | None = None,
        seed: int = 1,
        timeout_seconds: float = 30.0,
        environment_options: Mapping[str, Any] | None = None,
        episode_seeds: Sequence[int] | None = None,
        wire_format: str = "COMPACT",
    ) -> None:
        super().__init__()
        self.observation_space = gym.spaces.Box(-1.0, 1.0, shape=(OBSERVATION_SIZE,), dtype=np.float32)
        self.action_space = gym.spaces.Discrete(ACTION_COUNT)
        self._engine_dir = Path(engine_dir) if engine_dir else Path(__file__).resolve().parents[2]
        npm = shutil.which("npm") or "npm"
        self._command = list(command or [npm, "run", "--silent", "protocol:stdio"])
        self._timeout = timeout_seconds
        self._initial_seed = int(seed)
        self._episode_seeds = tuple(int(value) for value in (episode_seeds or (seed,)))
        if not self._episode_seeds:
            raise ValueError("episode_seeds must not be empty")
        self._episode_index = 0
        self._options = dict(environment_options or {})
        if wire_format not in {"FULL", "COMPACT"}:
            raise ValueError("wire_format must be FULL or COMPACT")
        self._wire_format = wire_format
        self._environment_id = f"gym-{uuid.uuid4().hex}"
        self._client: TrainingProcessClient | None = None
        self._created = False
        self._last_mask: dict[str, Any] | None = None
        self._start_and_create()

    def reset(self, *, seed: int | None = None, options: dict[str, Any] | None = None):
        if seed is None:
            reset_seed = self._episode_seeds[self._episode_index % len(self._episode_seeds)]
            self._episode_index += 1
        else:
            reset_seed = int(seed)
        super().reset(seed=reset_seed)
        if options:
            self._options.update(options)
            self._start_and_create(seed=reset_seed)
        elif self._client is None or not self._client.is_alive:
            self._start_and_create(seed=reset_seed)
        assert self._client is not None
        result = self._client.request("RESET", {"environmentId": self._environment_id, "seed": reset_seed})
        return self._observation(result), self._info(result)

    def step(self, action: int):
        if self._client is None or not self._client.is_alive:
            raise ProtocolError("PROCESS_DIED", "The training process died; call reset() to recreate the environment")
        if self._last_mask is None:
            raise ProtocolError("RESET_REQUIRED", "Call reset() before step()")
        command = self._command_for_action(int(action))
        result = self._client.request("STEP", {"environmentId": self._environment_id, "action": command})
        observation = self._observation(result)
        return observation, float(result["reward"]), bool(result["terminated"]), bool(result["truncated"]), self._info(result)

    def close(self) -> None:
        if self._client is None:
            return
        if self._client.is_alive and self._created:
            try:
                self._client.request("CLOSE_ENV", {"environmentId": self._environment_id})
            except ProtocolError:
                pass
        self._client.close()
        self._client = None
        self._created = False
        self._last_mask = None

    def action_masks(self) -> np.ndarray:
        if self._last_mask is None:
            return np.zeros(ACTION_COUNT, dtype=np.int8)
        return np.asarray(self._last_mask["bits"], dtype=np.int8)

    def _start_and_create(self, seed: int | None = None) -> None:
        if self._client is not None:
            self._client.close()
        self._client = TrainingProcessClient(self._command, self._engine_dir, self._timeout)
        hello = self._client.request("HELLO")
        expected = {
            "protocolVersion": PROTOCOL_VERSION,
            "observationVersion": 1,
            "actionSpaceVersion": 1,
            "rewardVersion": 1,
            "environmentVersion": 1,
            "scenarioVersion": 1,
        }
        mismatches = {key: (hello.get(key), value) for key, value in expected.items() if hello.get(key) != value}
        if mismatches:
            self._client.close()
            raise ProtocolError("SCHEMA_VERSION_MISMATCH", f"Incompatible TypeScript environment: {mismatches}")
        payload = {
            "environmentId": self._environment_id,
            "kind": "ATTACKER_VS_GOALKEEPER",
            "seed": self._initial_seed if seed is None else int(seed),
            "wireFormat": self._wire_format,
            **self._options,
        }
        self._client.request("CREATE", payload)
        self._created = True

    def _observation(self, result: Mapping[str, Any]) -> np.ndarray:
        observation = result["observation"]
        if observation.get("version") != 1:
            raise ProtocolError("OBSERVATION_VERSION_MISMATCH", f"Received observation v{observation.get('version')}")
        vector = np.asarray(observation["vector"], dtype=np.float32)
        if vector.shape != (OBSERVATION_SIZE,):
            raise ProtocolError("OBSERVATION_SHAPE_MISMATCH", f"Expected {(OBSERVATION_SIZE,)}, received {vector.shape}")
        self._last_mask = result["actionMask"]
        return vector

    def _info(self, result: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "action_mask": self.action_masks(),
            "action_mask_entries": self._last_mask["entries"] if self._last_mask else [],
            "actor_observation": result.get("observation"),
            "transition": result.get("info"),
            "outcome": result.get("outcome"),
            "reward_breakdown": result.get("rewardBreakdown"),
            "goalkeeper_position": result.get("goalkeeperPosition"),
        }

    def _command_for_action(self, action: int) -> dict[str, Any]:
        if not self.action_space.contains(action):
            raise ValueError(f"Action {action} is outside Discrete({ACTION_COUNT})")
        assert self._last_mask is not None
        entry = self._last_mask["entries"][action]
        if not entry["enabled"]:
            raise ValueError(f"Action {entry['id']} is masked at this decision boundary")
        targets = sorted(entry["validTargetIds"], key=lambda value: (value is not None, value or ""))
        if not targets:
            raise ProtocolError("INVALID_ACTION_MASK", f"Enabled action {entry['id']} has no target variant")
        command: dict[str, Any] = {"actionId": entry["id"]}
        if targets[0] is not None:
            command["targetId"] = targets[0]
        return command

    def __enter__(self) -> "AttackerVsGoalkeeperEnv":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

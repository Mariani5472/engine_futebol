from __future__ import annotations

import shutil
import uuid
from pathlib import Path
from typing import Any, Mapping, Sequence

import numpy as np

from .client import PROTOCOL_VERSION, ProtocolError, TrainingProcessClient
from .env import ACTION_COUNT, OBSERVATION_SIZE

CURRICULUM_STAGES = (
    "PASS", "TWO_V_ONE", "THREE_V_TWO", "FIVE_V_FIVE", "LEARNED_GOALKEEPER",
    "ELEVEN_V_ELEVEN", "COLLECTIVE_POLICY", "SELF_PLAY",
)


class ParallelCurriculumEnv:
    """Minimal parallel multi-agent API over the authoritative TypeScript engine.

    A trainer may route every home player through one shared network, use a separate
    goalkeeper network, or route each team to a different checkpoint in self-play.
    Agent IDs and masks are supplied by the engine at each joint decision boundary.
    """

    def __init__(
        self,
        stage: str,
        *,
        player_ids: Sequence[str] | None = None,
        command: Sequence[str] | None = None,
        engine_dir: str | Path | None = None,
        seed: int = 1,
        timeout_seconds: float = 30.0,
        environment_options: Mapping[str, Any] | None = None,
        wire_format: str = "COMPACT",
    ) -> None:
        if stage not in CURRICULUM_STAGES:
            raise ValueError(f"Unknown curriculum stage: {stage}")
        if wire_format not in {"FULL", "COMPACT"}:
            raise ValueError("wire_format must be FULL or COMPACT")
        self.stage = stage
        self.possible_agents = tuple(player_ids or ())
        self.agents: list[str] = []
        self._engine_dir = Path(engine_dir) if engine_dir else Path(__file__).resolve().parents[2]
        npm = shutil.which("npm") or "npm"
        self._command = list(command or [npm, "run", "--silent", "protocol:stdio"])
        self._environment_id = f"curriculum-{uuid.uuid4().hex}"
        self._client = TrainingProcessClient(self._command, self._engine_dir, timeout_seconds)
        self._masks: dict[str, dict[str, Any]] = {}
        hello = self._client.request("HELLO")
        required = {"curriculum", "multi_agent", "shared_policy", "self_play"}
        if hello.get("protocolVersion") != PROTOCOL_VERSION or not required.issubset(set(hello.get("capabilities", []))):
            self._client.close()
            raise ProtocolError("SCHEMA_VERSION_MISMATCH", "TypeScript process does not support curriculum v1")
        payload: dict[str, Any] = {
            "environmentId": self._environment_id,
            "kind": "CURRICULUM",
            "stage": stage,
            "seed": int(seed),
            "wireFormat": wire_format,
            **dict(environment_options or {}),
        }
        if player_ids is not None:
            payload["playerIds"] = list(player_ids)
        self._client.request("CREATE", payload)

    def reset(self, *, seed: int = 1) -> tuple[dict[str, np.ndarray], dict[str, dict[str, Any]]]:
        result = self._client.request("RESET", {"environmentId": self._environment_id, "seed": int(seed)})
        observations = self._consume_boundary(result)
        return observations, self._infos(result)

    def step(self, actions: Mapping[str, int]):
        if set(actions) != set(self.agents):
            raise ValueError(f"Actions must match active agents exactly: expected {sorted(self.agents)}")
        commands = {agent: self._command_for_action(agent, int(action)) for agent, action in actions.items()}
        result = self._client.request("STEP", {"environmentId": self._environment_id, "actions": commands})
        observations = self._consume_boundary(result)
        rewards = {key: float(value) for key, value in result["rewards"].items()}
        terminated = {agent: bool(result["terminated"]) for agent in self.possible_agents or tuple(rewards)}
        truncated = {agent: bool(result["truncated"]) for agent in self.possible_agents or tuple(rewards)}
        return observations, rewards, terminated, truncated, self._infos(result)

    def action_masks(self) -> dict[str, np.ndarray]:
        return {agent: np.asarray(mask["bits"], dtype=np.int8) for agent, mask in self._masks.items()}

    def close(self) -> None:
        if not self._client:
            return
        if self._client.is_alive:
            try:
                self._client.request("CLOSE_ENV", {"environmentId": self._environment_id})
            except ProtocolError:
                pass
        self._client.close()

    def _consume_boundary(self, result: Mapping[str, Any]) -> dict[str, np.ndarray]:
        self.agents = list(result["activeAgentIds"])
        if not self.possible_agents:
            self.possible_agents = tuple(result.get("rewards", {}).keys() or self.agents)
        self._masks = dict(result["actionMasks"])
        observations: dict[str, np.ndarray] = {}
        for agent in self.agents:
            vector = np.asarray(result["observations"][agent]["vector"], dtype=np.float32)
            if vector.shape != (OBSERVATION_SIZE,):
                raise ProtocolError("OBSERVATION_SHAPE_MISMATCH", f"Expected {(OBSERVATION_SIZE,)}, received {vector.shape}")
            observations[agent] = vector
        return observations

    def _command_for_action(self, agent: str, action: int) -> dict[str, Any]:
        if not 0 <= action < ACTION_COUNT:
            raise ValueError(f"Action {action} is outside Discrete({ACTION_COUNT})")
        entry = self._masks[agent]["entries"][action]
        if not entry["enabled"]:
            raise ValueError(f"Action {entry['id']} is masked for {agent}")
        targets = sorted(entry["validTargetIds"], key=lambda value: (value is not None, value or ""))
        if not targets:
            raise ProtocolError("INVALID_ACTION_MASK", f"Enabled action {entry['id']} has no target")
        command: dict[str, Any] = {"actionId": entry["id"]}
        if targets[0] is not None:
            command["targetId"] = targets[0]
        return command

    def _infos(self, result: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
        return {
            agent: {
                "action_mask": np.asarray(self._masks.get(agent, {}).get("bits", np.zeros(ACTION_COUNT)), dtype=np.int8),
                "transition": result.get("info"),
                "reward_breakdown": result.get("rewardBreakdowns", {}).get(agent, []),
            }
            for agent in (self.possible_agents or tuple(result.get("rewards", {})))
        }

    def __enter__(self) -> "ParallelCurriculumEnv":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


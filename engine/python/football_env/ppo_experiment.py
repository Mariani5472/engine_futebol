from __future__ import annotations

import json
import math
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol, Sequence

import numpy as np

from .env import AttackerVsGoalkeeperEnv


@dataclass(frozen=True)
class ScenarioSpec:
    id: str
    attacker_distance: float
    attacker_lateral_offset: float

    def protocol_options(self) -> dict[str, Any]:
        return {
            "scenario": {
                "attackerDistanceFromGoal": self.attacker_distance,
                "attackerLateralOffset": self.attacker_lateral_offset,
                "freezeGoalkeeper": True,
                "isolateOtherPlayers": True,
            },
            "maxDecisionSteps": 20,
            "maxEpisodePhysicalTicks": 2_000,
            "maxPhysicalTicksPerStep": 1_000,
        }


TRAINING_SCENARIOS: tuple[ScenarioSpec, ...] = (
    ScenarioSpec("train-14-centre", 14, 0),
    ScenarioSpec("train-18-left", 18, -4),
    ScenarioSpec("train-18-right", 18, 4),
    ScenarioSpec("train-22-centre", 22, 0),
)

GENERALIZATION_SCENARIOS: tuple[ScenarioSpec, ...] = (
    ScenarioSpec("generalization-10-wide-left", 10, -8),
    ScenarioSpec("generalization-10-wide-right", 10, 8),
    ScenarioSpec("generalization-26-centre", 26, 0),
    ScenarioSpec("generalization-24-wide-left", 24, -7),
    ScenarioSpec("generalization-24-wide-right", 24, 7),
)


class ActionPolicy(Protocol):
    id: str

    def select(self, observation: np.ndarray, info: Mapping[str, Any]) -> int: ...


class RandomValidPolicy:
    id = "RANDOM_VALID"

    def __init__(self, seed: int) -> None:
        self._random = random.Random(seed)

    def select(self, observation: np.ndarray, info: Mapping[str, Any]) -> int:
        del observation
        valid = _valid_indices(info)
        useful = [index for index in valid if _action_id(info, index) != "NONE"]
        return self._random.choice(useful or valid)


class ImmediateShotPolicy:
    id = "IMMEDIATE_SHOT"

    def select(self, observation: np.ndarray, info: Mapping[str, Any]) -> int:
        del observation
        return _first_available(info, ("SHOT", "DRIBBLE", "HOLD_BALL"))


class ApproachAndShootPolicy:
    id = "APPROACH_AND_SHOOT"

    def __init__(self, threshold: float = 0.15) -> None:
        self.threshold = threshold

    def select(self, observation: np.ndarray, info: Mapping[str, Any]) -> int:
        del observation
        actor = info["actor_observation"]
        direction = actor["self"]["attackingDirection"]
        x = actor["self"]["position"][0]
        distance = 1 - x if direction == 1 else x
        priorities = ("SHOT", "DRIBBLE", "HOLD_BALL") if distance <= self.threshold else ("DRIBBLE", "SHOT", "HOLD_BALL")
        return _first_available(info, priorities)


class ObservableHeuristicPolicy:
    id = "OBSERVABLE_HEURISTIC"

    def select(self, observation: np.ndarray, info: Mapping[str, Any]) -> int:
        del observation
        actor = info["actor_observation"]
        direction = actor["self"]["attackingDirection"]
        x = actor["self"]["position"][0]
        distance = 1 - x if direction == 1 else x
        nearby = sum(1 for opponent in actor["opponents"] if opponent["present"] == 1 and opponent["distance"] < 0.08)
        pressure = min(1.0, nearby / 3)
        scores = {
            "SHOT": 1.45 - distance * 3.2 - pressure * 0.25,
            "DRIBBLE": 0.75 + distance * 0.55 - pressure * 0.6,
            "PASS": 0.52 + pressure * 0.5,
            "CROSS": 0.38 + (0.35 if distance < 0.25 else 0),
            "HOLD_BALL": 0.12 + pressure * 0.25,
            "SKILL_MOVE": 0.2 + pressure * 0.2,
            "CLEAR": -0.1,
            "NONE": -10.0,
        }
        return max(_valid_indices(info), key=lambda index: (scores.get(_action_id(info, index), 0), -index))


class PpoPolicy:
    id = "PPO_V1"

    def __init__(self, model: Any) -> None:
        self.model = model

    def select(self, observation: np.ndarray, info: Mapping[str, Any]) -> int:
        action, _ = self.model.predict(observation, action_masks=np.asarray(info["action_mask"], dtype=bool), deterministic=True)
        return int(action)


@dataclass(frozen=True)
class EpisodeResult:
    policy_id: str
    partition: str
    scenario_id: str
    seed: int
    outcome: str
    episode_return: float
    decisions: int
    terminated: bool
    truncated: bool


def evaluate_policy(
    policy_factory: Callable[[int], ActionPolicy],
    scenarios: Sequence[ScenarioSpec],
    seeds: Sequence[int],
    partition: str,
    *,
    engine_dir: str | Path | None = None,
    command: Sequence[str] | None = None,
) -> list[EpisodeResult]:
    results: list[EpisodeResult] = []
    for scenario in scenarios:
        with AttackerVsGoalkeeperEnv(
            engine_dir=engine_dir,
            command=command,
            seed=seeds[0],
            episode_seeds=seeds,
            wire_format="FULL",
            environment_options=scenario.protocol_options(),
        ) as environment:
            for seed in seeds:
                policy = policy_factory(seed)
                observation, info = environment.reset(seed=seed)
                # Policies may use only the actor observation already exposed by
                # the protocol, never critic/debug state.
                episode_return = 0.0
                decisions = 0
                terminated = truncated = False
                while not (terminated or truncated):
                    action = policy.select(observation, info)
                    observation, reward, terminated, truncated, info = environment.step(action)
                    episode_return += reward
                    decisions += 1
                results.append(EpisodeResult(
                    policy.id, partition, scenario.id, seed, str(info.get("outcome") or "TIMEOUT"),
                    episode_return, decisions, terminated, truncated,
                ))
    return results


def build_evaluation_report(results: Sequence[EpisodeResult], confidence: float = 0.95) -> dict[str, Any]:
    groups: dict[tuple[str, str], list[EpisodeResult]] = {}
    for result in results:
        groups.setdefault((result.policy_id, result.partition), []).append(result)
    summaries = []
    for (policy_id, partition), episodes in sorted(groups.items()):
        goals = sum(result.outcome == "GOAL" for result in episodes)
        on_target = sum(result.outcome in {"GOAL", "SAVED_CAUGHT", "SAVED_PARRIED"} for result in episodes)
        summaries.append({
            "policyId": policy_id,
            "partition": partition,
            "episodes": len(episodes),
            "goalRate": _wilson(goals, len(episodes), confidence),
            "onTargetRate": _wilson(on_target, len(episodes), confidence),
            "return": _mean_interval([result.episode_return for result in episodes], confidence),
            "decisions": _mean_interval([float(result.decisions) for result in episodes], confidence),
            "outcomes": {outcome: sum(result.outcome == outcome for result in episodes) for outcome in sorted({r.outcome for r in episodes})},
        })
    comparisons = []
    by_policy_partition = {(row["policyId"], row["partition"]): row for row in summaries}
    for partition in sorted({row["partition"] for row in summaries}):
        ppo = by_policy_partition.get(("PPO_V1", partition))
        if not ppo:
            continue
        for baseline in ("RANDOM_VALID", "IMMEDIATE_SHOT", "APPROACH_AND_SHOOT", "OBSERVABLE_HEURISTIC"):
            reference = by_policy_partition.get((baseline, partition))
            if reference:
                comparisons.append({
                    "partition": partition,
                    "baselineId": baseline,
                    "goalRateDelta": ppo["goalRate"]["estimate"] - reference["goalRate"]["estimate"],
                    "returnDelta": ppo["return"]["estimate"] - reference["return"]["estimate"],
                })
    in_distribution = by_policy_partition.get(("PPO_V1", "IN_DISTRIBUTION"))
    generalization = by_policy_partition.get(("PPO_V1", "GENERALIZATION"))
    generalization_gap = None if not in_distribution or not generalization else {
        "goalRate": generalization["goalRate"]["estimate"] - in_distribution["goalRate"]["estimate"],
        "return": generalization["return"]["estimate"] - in_distribution["return"]["estimate"],
    }
    return {
        "experimentVersion": 1,
        "confidence": confidence,
        "summaries": summaries,
        "ppoComparisons": comparisons,
        "ppoGeneralizationGap": generalization_gap,
        "episodes": [asdict(result) for result in results],
    }


def save_report(report: Mapping[str, Any], path: str | Path) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")


def _valid_indices(info: Mapping[str, Any]) -> list[int]:
    valid = np.flatnonzero(np.asarray(info["action_mask"], dtype=np.int8)).tolist()
    if not valid:
        raise RuntimeError("Protocol returned an action mask with no valid action")
    return [int(index) for index in valid]


def _action_id(info: Mapping[str, Any], index: int) -> str:
    return str(info["action_mask_entries"][index]["id"])


def _first_available(info: Mapping[str, Any], priorities: Sequence[str]) -> int:
    by_id = {_action_id(info, index): index for index in _valid_indices(info)}
    for action_id in priorities:
        if action_id in by_id:
            return by_id[action_id]
    return min(by_id.values())


def _wilson(successes: int, samples: int, confidence: float) -> dict[str, float]:
    # v1 currently supports the documented 95% experiment confidence.
    if confidence != 0.95:
        raise ValueError("PPO experiment v1 supports confidence=0.95")
    z = 1.959963984540054
    estimate = successes / samples
    denominator = 1 + z * z / samples
    centre = (estimate + z * z / (2 * samples)) / denominator
    margin = z * math.sqrt((estimate * (1 - estimate) + z * z / (4 * samples)) / samples) / denominator
    return {"estimate": estimate, "lower": max(0, centre - margin), "upper": min(1, centre + margin)}


def _mean_interval(values: Sequence[float], confidence: float) -> dict[str, float]:
    if confidence != 0.95:
        raise ValueError("PPO experiment v1 supports confidence=0.95")
    estimate = sum(values) / len(values)
    if len(values) == 1:
        return {"estimate": estimate, "lower": estimate, "upper": estimate}
    variance = sum((value - estimate) ** 2 for value in values) / (len(values) - 1)
    margin = 1.959963984540054 * math.sqrt(variance / len(values))
    return {"estimate": estimate, "lower": estimate - margin, "upper": estimate + margin}

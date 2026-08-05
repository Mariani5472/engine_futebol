from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from collections import defaultdict
from typing import Mapping

import numpy as np

from .env import ACTION_COUNT, OBSERVATION_SIZE


@dataclass(frozen=True)
class PolicyTransition:
    agent_id: str
    observation: np.ndarray
    mask: np.ndarray
    action: int
    reward: float


class SharedMaskedLinearPolicy:
    """Small deterministic shared policy trainable without a joint action explosion."""

    def __init__(self, seed: int = 1, weights: np.ndarray | None = None,
                 value_weights: np.ndarray | None = None) -> None:
        random = np.random.default_rng(seed)
        self.weights = np.asarray(weights, dtype=np.float32) if weights is not None else random.normal(
            0.0, 0.01, size=(ACTION_COUNT, OBSERVATION_SIZE),
        ).astype(np.float32)
        if self.weights.shape != (ACTION_COUNT, OBSERVATION_SIZE):
            raise ValueError("invalid shared policy weight shape")
        self.value_weights = (np.asarray(value_weights, dtype=np.float32) if value_weights is not None
                              else np.zeros(OBSERVATION_SIZE, dtype=np.float32))
        if self.value_weights.shape != (OBSERVATION_SIZE,):
            raise ValueError("invalid shared value weight shape")

    def act(self, observation: np.ndarray, mask: np.ndarray, *, stochastic: bool, random: np.random.Generator) -> int:
        enabled = np.flatnonzero(mask)
        if enabled.size == 0:
            raise ValueError("action mask contains no valid action")
        logits = self.weights @ observation
        valid_logits = logits[enabled]
        if not stochastic:
            return int(enabled[int(np.argmax(valid_logits))])
        probabilities = self._softmax(valid_logits)
        return int(random.choice(enabled, p=probabilities))

    def update(self, transitions: list[PolicyTransition], learning_rate: float = 1e-2,
               value_learning_rate: float = 2e-2, gamma: float = 0.99,
               gae_lambda: float = 0.95, epochs: int = 4) -> None:
        if not transitions:
            return
        trajectories: dict[str, list[PolicyTransition]] = defaultdict(list)
        for transition in transitions:
            trajectories[transition.agent_id].append(transition)

        samples: list[tuple[PolicyTransition, float, float]] = []
        for trajectory in trajectories.values():
            observations = np.stack([item.observation for item in trajectory])
            values = observations @ self.value_weights
            advantages = np.empty(len(trajectory), dtype=np.float32)
            gae = 0.0
            for index in range(len(trajectory) - 1, -1, -1):
                next_value = float(values[index + 1]) if index + 1 < len(trajectory) else 0.0
                delta = trajectory[index].reward + gamma * next_value - float(values[index])
                gae = delta + gamma * gae_lambda * gae
                advantages[index] = gae
            targets = advantages + values
            samples.extend((transition, float(advantage), float(target))
                           for transition, advantage, target in zip(trajectory, advantages, targets, strict=True))

        raw_advantages = np.asarray([sample[1] for sample in samples], dtype=np.float32)
        advantage_std = float(raw_advantages.std())
        if advantage_std > 1e-6:
            normalized = (raw_advantages - raw_advantages.mean()) / advantage_std
        else:
            # Centering a constant sparse reward would erase the entire learning
            # signal. The critic already supplies the baseline in this case.
            normalized = raw_advantages / (float(np.mean(np.abs(raw_advantages))) + 1e-6)
        for _ in range(epochs):
            policy_gradient = np.zeros_like(self.weights)
            value_gradient = np.zeros_like(self.value_weights)
            for (transition, _, target), advantage in zip(samples, normalized, strict=True):
                enabled = np.flatnonzero(transition.mask)
                logits = self.weights @ transition.observation
                probabilities = self._softmax(logits[enabled])
                for local, action in enumerate(enabled):
                    coefficient = (1.0 if int(action) == transition.action else 0.0) - probabilities[local]
                    policy_gradient[int(action)] += advantage * coefficient * transition.observation
                value_error = target - float(self.value_weights @ transition.observation)
                value_gradient += value_error * transition.observation
            scale = 1.0 / len(samples)
            self.weights += learning_rate * np.clip(policy_gradient * scale, -5.0, 5.0)
            self.value_weights += value_learning_rate * np.clip(value_gradient * scale, -5.0, 5.0)

    def save(self, path: str | Path, metadata: Mapping[str, object]) -> Path:
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        checkpoint_metadata = {"policyFormatVersion": 2, "algorithm": "MASKED_LINEAR_ACTOR_CRITIC_GAE", **dict(metadata)}
        np.savez_compressed(destination, weights=self.weights, value_weights=self.value_weights,
                            metadata=np.asarray([checkpoint_metadata], dtype=object))
        return destination

    @classmethod
    def load(cls, path: str | Path) -> "SharedMaskedLinearPolicy":
        with np.load(Path(path), allow_pickle=True) as payload:
            value_weights = payload["value_weights"] if "value_weights" in payload.files else None
            return cls(weights=payload["weights"], value_weights=value_weights)

    @staticmethod
    def _softmax(values: np.ndarray) -> np.ndarray:
        shifted = values - np.max(values)
        exponent = np.exp(shifted)
        return exponent / exponent.sum()

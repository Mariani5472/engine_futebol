from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from football_env.curriculum_env import ParallelCurriculumEnv
from football_env.curriculum_manager import ModelRegistry, atomic_write_json
from football_env.small_sided_league import SmallSidedLeagueRegistry
from football_env.small_sided_policy import PolicyTransition, SharedMaskedLinearPolicy
from football_env.statistical_gates import mean_confidence_interval, paired_difference_interval


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and promote a shared masked policy for reduced football.")
    parser.add_argument("--stage", choices=("FIVE_V_FIVE", "SEVEN_V_SEVEN"), required=True)
    parser.add_argument("--episodes", type=int, default=32)
    parser.add_argument("--evaluation-episodes", type=int, default=20)
    parser.add_argument("--seed", type=int, default=50_000)
    parser.add_argument("--registry", type=Path, default=Path("artifacts/model-registry"))
    parser.add_argument("--checkpoint-id", required=True)
    parser.add_argument("--minimum-mean-return", type=float, default=-0.05)
    parser.add_argument("--minimum-evaluation-episodes", type=int, default=20)
    parser.add_argument("--initial-checkpoint", type=Path)
    parser.add_argument("--reference-checkpoint", type=Path,
                        help="Promoted checkpoint used by the superiority gate; defaults to initial-checkpoint")
    parser.add_argument("--minimum-superiority", type=float, default=0.0)
    parser.add_argument("--evaluation-workers", type=int, default=1)
    args = parser.parse_args()
    if args.episodes <= 0 or args.evaluation_episodes < args.minimum_evaluation_episodes or args.evaluation_workers <= 0:
        parser.error("episode counts must be positive")

    policy = SharedMaskedLinearPolicy.load(args.initial_checkpoint) if args.initial_checkpoint else SharedMaskedLinearPolicy(args.seed)
    reference_checkpoint = args.reference_checkpoint or args.initial_checkpoint
    previous_policy = SharedMaskedLinearPolicy.load(reference_checkpoint) if reference_checkpoint else None
    initial_policy_weights = policy.weights.copy()
    initial_value_weights = policy.value_weights.copy()
    training_returns = [run_episode(args.stage, args.seed + index, policy, "TRAIN") for index in range(args.episodes)]
    held_out_seeds = list(range(args.seed + 100_000, args.seed + 100_000 + args.evaluation_episodes))
    evaluation_returns = evaluate(args.stage, held_out_seeds, policy, "POLICY", args.evaluation_workers)
    baseline_returns = evaluate(args.stage, held_out_seeds, None, "RANDOM_VALID", args.evaluation_workers)
    previous_returns = evaluate(args.stage, held_out_seeds, previous_policy, "POLICY", args.evaluation_workers) if previous_policy else None
    return_interval = mean_confidence_interval(evaluation_returns)
    baseline_advantage = paired_difference_interval(evaluation_returns, baseline_returns)
    previous_advantage = paired_difference_interval(evaluation_returns, previous_returns) if previous_returns else None
    run_dir = args.registry / "runs" / f"{args.checkpoint_id}-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
    candidate = policy.save(run_dir / "policy.npz", {
        "stage": args.stage, "seed": args.seed, "algorithmVersion": 2,
    })
    update_diagnostics = {
        "policyL2Delta": float(np.linalg.norm(policy.weights - initial_policy_weights)),
        "criticL2Delta": float(np.linalg.norm(policy.value_weights - initial_value_weights)),
        "changedPolicyParameters": int(np.count_nonzero(policy.weights != initial_policy_weights)),
        "totalPolicyParameters": int(policy.weights.size),
    }
    report = {
        "version": 2, "stage": args.stage, "trainingEpisodes": args.episodes,
        "trainingMeanReturn": float(np.mean(training_returns)), "evaluationSeeds": held_out_seeds,
        "algorithm": "MASKED_LINEAR_ACTOR_CRITIC_GAE", "updateDiagnostics": update_diagnostics,
        "evaluationReturns": evaluation_returns, "evaluationReturnInterval": return_interval,
        "randomValidReturns": baseline_returns, "randomValidAdvantageInterval": baseline_advantage,
        "initialCheckpoint": str(args.initial_checkpoint) if args.initial_checkpoint else None,
        "previousCheckpoint": str(reference_checkpoint) if reference_checkpoint else None,
        "previousReturns": previous_returns, "previousAdvantageInterval": previous_advantage,
        "minimumMeanReturn": args.minimum_mean_return,
        "minimumSuperiority": args.minimum_superiority,
        "gateReasons": [],
    }
    if return_interval["lower"] < args.minimum_mean_return:
        report["gateReasons"].append("evaluation return lower bound is below threshold")
    if baseline_advantage["lower"] <= args.minimum_superiority:
        report["gateReasons"].append("candidate has not proven superiority over RANDOM_VALID")
    if previous_advantage and previous_advantage["lower"] <= args.minimum_superiority:
        report["gateReasons"].append("candidate has not proven superiority over previous checkpoint")
    report["promoted"] = not report["gateReasons"]
    atomic_write_json(run_dir / "evaluation.json", report)
    if not report["promoted"]:
        print(json.dumps(report, indent=2))
        raise SystemExit(2)
    registry = ModelRegistry(args.registry)
    record = registry.promote(args.checkpoint_id, candidate, {
        "kind": "COLLECTIVE", "stage": args.stage, "policyVersion": 1,
        "algorithmVersion": 2,
        "observationVersion": 1, "actionSpaceVersion": 1,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "evaluationPath": str((run_dir / "evaluation.json").relative_to(args.registry)).replace("\\", "/"),
    })
    SmallSidedLeagueRegistry(args.registry).register(record, args.stage)
    print(json.dumps({**report, "checkpoint": record}, indent=2))


def run_episode(stage: str, seed: int, policy: SharedMaskedLinearPolicy | None, mode: str) -> float:
    random = np.random.default_rng(seed)
    transitions: list[PolicyTransition] = []
    total = 0.0
    with ParallelCurriculumEnv(stage, seed=seed, environment_options={
        "maxJointDecisionSteps": 160,
        "maxEpisodePhysicalTicks": 12_000,
        "maxPhysicalTicksPerStep": 600,
    }) as environment:
        observations, _ = environment.reset(seed=seed)
        for _ in range(160):
            masks = environment.action_masks()
            actions = {
                agent: (int(random.choice(np.flatnonzero(masks[agent]))) if mode == "RANDOM_VALID"
                        else policy.act(observation, masks[agent], stochastic=mode == "TRAIN", random=random))
                for agent, observation in observations.items()
            }
            next_observations, rewards, terminated, truncated, _ = environment.step(actions)
            for agent, action in actions.items():
                transitions.append(PolicyTransition(agent, observations[agent], masks[agent], action, rewards[agent]))
                total += rewards[agent]
            observations = next_observations
            if any(terminated.values()) or any(truncated.values()):
                break
    if mode == "TRAIN":
        assert policy is not None
        policy.update(transitions)
    return total / max(1, len(transitions))


def evaluate(stage: str, seeds: list[int], policy: SharedMaskedLinearPolicy | None,
             mode: str, workers: int) -> list[float]:
    """Evaluate independent seeds concurrently while preserving seed order."""
    if workers == 1:
        return [run_episode(stage, seed, policy, mode) for seed in seeds]
    with ThreadPoolExecutor(max_workers=workers) as executor:
        return list(executor.map(lambda seed: run_episode(stage, seed, policy, mode), seeds))


if __name__ == "__main__":
    main()

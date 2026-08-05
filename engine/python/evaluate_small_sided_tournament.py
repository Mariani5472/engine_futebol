from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from football_env.curriculum_env import ParallelCurriculumEnv
from football_env.curriculum_manager import atomic_write_json
from football_env.small_sided_policy import SharedMaskedLinearPolicy
from football_env.statistical_gates import mean_confidence_interval, paired_difference_interval

FROZEN_STYLES = {
    "HIGH_PRESS": {"tempo": "HIGH", "width": "BALANCED", "passingStyle": "SHORTER", "defensiveLine": "HIGH", "pressLine": "HIGH", "pressingIntensity": "HIGH", "counterPress": True, "counterAttack": False, "regroup": False},
    "LOW_BLOCK": {"tempo": "LOW", "width": "NARROW", "passingStyle": "DIRECT", "defensiveLine": "LOW", "pressLine": "LOW", "pressingIntensity": "LOW", "counterPress": False, "counterAttack": True, "regroup": True},
    "TRANSITION": {"tempo": "HIGH", "width": "WIDE", "passingStyle": "DIRECT", "defensiveLine": "STANDARD", "pressLine": "MID", "pressingIntensity": "NORMAL", "counterPress": False, "counterAttack": True, "regroup": True},
    "POSSESSION": {"tempo": "LOW", "width": "WIDE", "passingStyle": "SHORTER", "defensiveLine": "HIGH", "pressLine": "MID", "pressingIntensity": "NORMAL", "counterPress": True, "counterAttack": False, "regroup": False},
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Official held-out small-sided checkpoint tournament.")
    parser.add_argument("--stage", choices=("FIVE_V_FIVE", "SEVEN_V_SEVEN"), required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=900_000)
    parser.add_argument("--episodes-per-style", type=int, default=8)
    parser.add_argument("--minimum-worst-style-return", type=float, default=-0.08)
    parser.add_argument("--minimum-episodes-per-style", type=int, default=8)
    parser.add_argument("--reference-checkpoint", type=Path)
    parser.add_argument("--minimum-superiority", type=float, default=0.0)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.episodes_per_style < args.minimum_episodes_per_style:
        parser.error("episodes-per-style is below the statistical gate minimum")
    policy = SharedMaskedLinearPolicy.load(args.checkpoint)
    reference = SharedMaskedLinearPolicy.load(args.reference_checkpoint) if args.reference_checkpoint else None
    rows = []
    for style_index, (style, tactics) in enumerate(FROZEN_STYLES.items()):
        seeds = [args.seed + style_index * 10_000 + index for index in range(args.episodes_per_style)]
        returns = [episode(args.stage, seed, policy, tactics) for seed in seeds]
        reference_returns = [episode(args.stage, seed, reference, tactics) for seed in seeds] if reference else None
        rows.append({"style": style, "seeds": seeds, "returns": returns,
                     "returnInterval": mean_confidence_interval(returns),
                     "referenceReturns": reference_returns,
                     "referenceAdvantageInterval": paired_difference_interval(returns, reference_returns) if reference_returns else None})
    worst = min(row["returnInterval"]["lower"] for row in rows)
    reasons = []
    if worst < args.minimum_worst_style_return:
        reasons.append("a style return lower bound is below threshold")
    if reference and any(row["referenceAdvantageInterval"]["lower"] <= args.minimum_superiority for row in rows):
        reasons.append("superiority over reference checkpoint was not proven in every style")
    report = {"version": 1, "stage": args.stage, "checkpoint": str(args.checkpoint), "styles": rows,
              "referenceCheckpoint": str(args.reference_checkpoint) if args.reference_checkpoint else None,
              "worstStyleReturnLowerBound": worst, "minimumWorstStyleReturn": args.minimum_worst_style_return,
              "minimumSuperiority": args.minimum_superiority, "gateReasons": reasons,
              "gate": "COMPLETE" if not reasons else "BLOCKED"}
    atomic_write_json(args.output, report)
    print(json.dumps(report, indent=2))
    if report["gate"] != "COMPLETE":
        raise SystemExit(2)


def episode(stage: str, seed: int, policy: SharedMaskedLinearPolicy, defending_tactics: dict[str, object]) -> float:
    random = np.random.default_rng(seed)
    total = 0.0
    count = 0
    with ParallelCurriculumEnv(stage, seed=seed, environment_options={
        "defendingTactics": defending_tactics, "maxJointDecisionSteps": 160,
        "maxEpisodePhysicalTicks": 12_000, "maxPhysicalTicksPerStep": 600,
    }) as environment:
        observations, _ = environment.reset(seed=seed)
        for _ in range(160):
            masks = environment.action_masks()
            actions = {agent: policy.act(observation, masks[agent], stochastic=False, random=random) for agent, observation in observations.items()}
            observations, rewards, terminated, truncated, _ = environment.step(actions)
            total += sum(rewards.values())
            count += len(rewards)
            if any(terminated.values()) or any(truncated.values()):
                break
    return total / max(1, count)


if __name__ == "__main__":
    main()

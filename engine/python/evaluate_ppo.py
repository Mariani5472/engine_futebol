from __future__ import annotations

import argparse
import shlex
from pathlib import Path

from sb3_contrib import MaskablePPO

from train_ppo import evaluate_all, print_summary
from football_env.ppo_experiment import build_evaluation_report, save_report


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate PPO v1 against paired baselines and unseen scenarios.")
    parser.add_argument("model", type=Path)
    parser.add_argument("--seed", type=int, default=1_002_026)
    parser.add_argument("--seeds", type=int, default=100)
    parser.add_argument("--output", type=Path, default=Path("artifacts/ppo-v1/evaluation-standalone.json"))
    parser.add_argument("--engine-dir", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--protocol-command", type=str, default=None)
    args = parser.parse_args()
    if args.seeds <= 0:
        parser.error("seeds must be positive")
    command = shlex.split(args.protocol_command) if args.protocol_command else None
    model = MaskablePPO.load(args.model)
    seeds = tuple(range(args.seed, args.seed + args.seeds))
    report = build_evaluation_report(evaluate_all(model, seeds, args.engine_dir, command))
    report["model"] = str(args.model)
    report["evaluationSeeds"] = list(seeds)
    save_report(report, args.output)
    print_summary(report)


if __name__ == "__main__":
    main()

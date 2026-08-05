from __future__ import annotations

import argparse
import json
import shlex
from datetime import datetime, timezone
from pathlib import Path

from sb3_contrib import MaskablePPO

from football_env.client import TrainingProcessClient
from football_env.curriculum_manager import FundamentalCurriculumManager
from football_env.fundamental_env import FUNDAMENTAL_SKILLS
from football_env.fundamental_ppo import FundamentalPpoEpisodeRunner, curriculum_phases, train_fundamental_ppo


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and officially gate a fundamental masked-PPO checkpoint.")
    parser.add_argument("--skill", choices=FUNDAMENTAL_SKILLS, default="MOVEMENT")
    parser.add_argument("--timesteps", type=int, default=30_000)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--training-seeds", type=int, default=200)
    parser.add_argument("--selection-seeds", type=int, default=100)
    parser.add_argument("--evaluation-seeds", type=int, default=100)
    parser.add_argument("--generalization-seeds", type=int, default=100)
    parser.add_argument("--regression-seeds", type=int, default=100)
    parser.add_argument("--output", type=Path, default=Path("artifacts/fundamental-ppo"))
    parser.add_argument("--registry", type=Path, default=Path("artifacts/model-registry"))
    parser.add_argument("--checkpoint-id", type=str, default=None)
    parser.add_argument("--engine-dir", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--protocol-command", type=str, default=None)
    parser.add_argument("--checkpoint", type=Path, default=None, help="Evaluate an existing MaskablePPO checkpoint without retraining")
    args = parser.parse_args()
    counts = {
        "training": args.training_seeds,
        "selection": args.selection_seeds,
        "evaluation": args.evaluation_seeds,
        "generalization": args.generalization_seeds,
        "regression": args.regression_seeds,
    }
    if args.timesteps <= 0 or any(value <= 0 for value in counts.values()):
        parser.error("timesteps and all partition counts must be positive")
    command = shlex.split(args.protocol_command) if args.protocol_command else ["npm", "run", "--silent", "protocol:stdio"]
    args.output.mkdir(parents=True, exist_ok=True)

    with TrainingProcessClient(command, args.engine_dir, timeout_seconds=60) as client:
        manager = FundamentalCurriculumManager(client, args.registry)
        plan = manager.prepare_plan(args.seed, counts)
        if args.checkpoint is None:
            model = train_fundamental_ppo(
                skill=args.skill,
                training_seeds=plan["training"],
                total_timesteps=args.timesteps,
                root_seed=args.seed,
                engine_dir=args.engine_dir,
                command=command,
            )
            candidate = args.output / f"{args.skill.lower()}-candidate"
            model.save(candidate)
            checkpoint = candidate.with_suffix(".zip")
        else:
            checkpoint = args.checkpoint
            model = MaskablePPO.load(checkpoint)
        checkpoint_id = args.checkpoint_id or f"{args.skill.lower()}-ppo-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}"
        with FundamentalPpoEpisodeRunner(model, engine_dir=args.engine_dir, command=command) as runner:
            result = manager.evaluate_and_promote(
                skill=args.skill,
                root_seed=args.seed,
                runner=runner,
                checkpoint_path=checkpoint,
                checkpoint_id=checkpoint_id,
                counts=counts,
                lineage=["masked-ppo-v1"],
                versions={"protocol": 1, "observation": 1, "actionSpace": 1, "reward": 1, "fundamentalTraining": 1},
                metadata={
                    "algorithm": "MaskablePPO",
                    "timesteps": args.timesteps if args.checkpoint is None else 0,
                    "evaluatedCheckpoint": str(checkpoint) if args.checkpoint is not None else None,
                    "curriculumLevels": [phase.difficulty_level for phase in curriculum_phases(args.timesteps, args.skill)],
                    "rehearsalRate": 0.25,
                },
            )
    summary_path = args.output / f"{args.skill.lower()}-official-result.json"
    summary_path.write_text(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    print(f"Official result: {'PROMOTED' if result['promoted'] else 'NOT PROMOTED'}")


if __name__ == "__main__":
    main()

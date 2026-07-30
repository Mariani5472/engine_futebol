from __future__ import annotations

import argparse
import json
import shlex
from pathlib import Path
from typing import Sequence

from sb3_contrib import MaskablePPO
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv

from football_env.env import AttackerVsGoalkeeperEnv
from football_env.ppo_experiment import (
    GENERALIZATION_SCENARIOS,
    TRAINING_SCENARIOS,
    ApproachAndShootPolicy,
    ImmediateShotPolicy,
    ObservableHeuristicPolicy,
    PpoPolicy,
    RandomValidPolicy,
    build_evaluation_report,
    evaluate_policy,
    save_report,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train the first masked PPO attacker against a frozen goalkeeper.")
    parser.add_argument("--timesteps", type=int, default=100_000)
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--train-envs", type=int, default=4)
    parser.add_argument("--worker-mode", choices=("auto", "dummy", "subprocess"), default="auto")
    parser.add_argument("--eval-seeds", type=int, default=20)
    parser.add_argument("--output", type=Path, default=Path("artifacts/ppo-v1"))
    parser.add_argument("--engine-dir", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--protocol-command", type=str, default=None, help="Optional shell-like command replacing npm run --silent protocol:stdio")
    args = parser.parse_args()
    if args.timesteps <= 0 or args.train_envs <= 0 or args.eval_seeds <= 0:
        parser.error("timesteps, train-envs and eval-seeds must be positive")
    if args.train_envs > 10_000:
        parser.error("train-envs cannot exceed the 10,000-seed training pool")

    command = shlex.split(args.protocol_command) if args.protocol_command else None
    training_seeds = tuple(range(args.seed, args.seed + 10_000))
    evaluation_seeds = tuple(range(args.seed + 1_000_000, args.seed + 1_000_000 + args.eval_seeds))
    if set(training_seeds).intersection(evaluation_seeds):
        raise RuntimeError("Training and evaluation seeds overlap")

    factories = [
        make_environment_factory(
            TRAINING_SCENARIOS[index % len(TRAINING_SCENARIOS)],
            training_seeds[index::args.train_envs],
            args.engine_dir,
            command,
        )
        for index in range(args.train_envs)
    ]
    worker_mode = "subprocess" if args.worker_mode == "auto" and args.train_envs > 1 else args.worker_mode
    if worker_mode == "auto":
        worker_mode = "dummy"
    vector_environment = SubprocVecEnv(factories, start_method="spawn") if worker_mode == "subprocess" else DummyVecEnv(factories)
    model = MaskablePPO(
        "MlpPolicy",
        vector_environment,
        seed=args.seed,
        verbose=1,
        n_steps=256,
        batch_size=64,
        learning_rate=3e-4,
        gamma=0.99,
        gae_lambda=0.95,
        ent_coef=0.01,
        policy_kwargs={"net_arch": [128, 128]},
    )
    try:
        model.learn(total_timesteps=args.timesteps)
    finally:
        vector_environment.close()

    args.output.mkdir(parents=True, exist_ok=True)
    model_path = args.output / "model"
    model.save(model_path)

    results = evaluate_all(model, evaluation_seeds, args.engine_dir, command)
    report = build_evaluation_report(results)
    report["experiment"] = {
        "id": "PPO_V1_ATTACKER_FROZEN_GOALKEEPER",
        "trainingSeedStart": training_seeds[0],
        "trainingSeedCount": len(training_seeds),
        "evaluationSeeds": list(evaluation_seeds),
        "timesteps": args.timesteps,
        "trainEnvironments": args.train_envs,
        "workerMode": worker_mode,
        "trainingScenarios": [scenario.__dict__ for scenario in TRAINING_SCENARIOS],
        "generalizationScenarios": [scenario.__dict__ for scenario in GENERALIZATION_SCENARIOS],
        "algorithm": "MaskablePPO",
        "hyperparameters": {
            "policy": "MlpPolicy",
            "network": [128, 128],
            "learningRate": 3e-4,
            "nSteps": 256,
            "batchSize": 64,
            "gamma": 0.99,
            "gaeLambda": 0.95,
            "entropyCoefficient": 0.01,
        },
        "model": str(model_path.with_suffix(".zip")),
    }
    save_report(report, args.output / "evaluation.json")
    (args.output / "run.json").write_text(json.dumps(report["experiment"], indent=2, sort_keys=True), encoding="utf-8")
    print_summary(report)


def make_environment_factory(scenario, seeds: Sequence[int], engine_dir: Path, command: Sequence[str] | None):
    def create():
        return AttackerVsGoalkeeperEnv(
            engine_dir=engine_dir,
            command=command,
            seed=seeds[0],
            episode_seeds=seeds,
            environment_options=scenario.protocol_options(),
        )
    return create


def evaluate_all(model, seeds: Sequence[int], engine_dir: Path, command: Sequence[str] | None):
    policies = (
        lambda seed: RandomValidPolicy(seed),
        lambda seed: ImmediateShotPolicy(),
        lambda seed: ApproachAndShootPolicy(),
        lambda seed: ObservableHeuristicPolicy(),
        lambda seed: PpoPolicy(model),
    )
    results = []
    for factory in policies:
        results.extend(evaluate_policy(factory, TRAINING_SCENARIOS, seeds, "IN_DISTRIBUTION", engine_dir=engine_dir, command=command))
        results.extend(evaluate_policy(factory, GENERALIZATION_SCENARIOS, seeds, "GENERALIZATION", engine_dir=engine_dir, command=command))
    return results


def print_summary(report) -> None:
    print("policy\tpartition\tepisodes\tgoal_rate\treturn")
    for row in report["summaries"]:
        print(f"{row['policyId']}\t{row['partition']}\t{row['episodes']}\t{row['goalRate']['estimate']:.3f}\t{row['return']['estimate']:.3f}")


if __name__ == "__main__":
    main()

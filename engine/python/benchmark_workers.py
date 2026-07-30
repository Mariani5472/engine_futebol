from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv

from football_env.env import AttackerVsGoalkeeperEnv
from football_env.ppo_experiment import TRAINING_SCENARIOS


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure gradual environment/worker scaling.")
    parser.add_argument("--scales", default="1,2,4,8")
    parser.add_argument("--episodes-per-worker", type=int, default=5)
    parser.add_argument("--seed", type=int, default=90_000)
    parser.add_argument("--engine-dir", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, default=Path("artifacts/performance/workers.json"))
    args = parser.parse_args()
    scales = [int(value) for value in args.scales.split(",")]
    if any(value <= 0 for value in scales) or args.episodes_per_worker <= 0:
        parser.error("scales and episodes-per-worker must be positive")
    profiles = [profile_scale(scale, args.episodes_per_worker, args.seed, args.engine_dir) for scale in scales]
    report = {"version": 1, "profiles": profiles}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


def profile_scale(workers: int, episodes_per_worker: int, seed: int, engine_dir: Path):
    factories = []
    for index in range(workers):
        scenario = TRAINING_SCENARIOS[index % len(TRAINING_SCENARIOS)]
        seeds = tuple(range(seed + index * 10_000, seed + index * 10_000 + episodes_per_worker + 2))

        def create(scenario=scenario, seeds=seeds):
            return AttackerVsGoalkeeperEnv(
                engine_dir=engine_dir,
                seed=seeds[0],
                episode_seeds=seeds,
                wire_format="COMPACT",
                environment_options=scenario.protocol_options(),
            )
        factories.append(create)

    environment = DummyVecEnv(factories) if workers == 1 else SubprocVecEnv(factories, start_method="spawn")
    target_episodes = workers * episodes_per_worker
    completed = steps = 0
    started = time.perf_counter()
    try:
        environment.reset()
        while completed < target_episodes:
            masks = environment.env_method("action_masks")
            actions = np.asarray([int(np.flatnonzero(mask)[0]) for mask in masks])
            _, _, dones, _ = environment.step(actions)
            steps += workers
            completed += int(np.sum(dones))
    finally:
        environment.close()
    elapsed = time.perf_counter() - started
    return {
        "workers": workers,
        "episodes": completed,
        "agentSteps": steps,
        "wallSeconds": elapsed,
        "episodesPerSecond": completed / elapsed,
        "agentStepsPerSecond": steps / elapsed,
    }


if __name__ == "__main__":
    main()

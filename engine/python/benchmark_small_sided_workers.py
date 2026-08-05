from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from football_env.curriculum_env import ParallelCurriculumEnv
from football_env.curriculum_manager import atomic_write_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile reduced-football environments and enforce a throughput gate.")
    parser.add_argument("--stage", choices=("FIVE_V_FIVE", "SEVEN_V_SEVEN"), required=True)
    parser.add_argument("--workers", default="1,2,4")
    parser.add_argument("--episodes-per-worker", type=int, default=2)
    parser.add_argument("--seed", type=int, default=700_000)
    parser.add_argument("--minimum-agent-steps-per-second", type=float, default=8.0)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    scales = [int(value) for value in args.workers.split(",")]
    profiles = [profile(args.stage, workers, args.episodes_per_worker, args.seed, args.minimum_agent_steps_per_second) for workers in scales]
    gate = "COMPLETE" if all(item["agentStepsPerSecond"] >= args.minimum_agent_steps_per_second for item in profiles) else "BLOCKED"
    report = {"version": 1, "stage": args.stage, "minimumAgentStepsPerSecond": args.minimum_agent_steps_per_second,
              "profiles": profiles, "gate": gate}
    atomic_write_json(args.output, report)
    print(json.dumps(report, indent=2))
    if gate != "COMPLETE":
        raise SystemExit(2)


def profile(stage: str, workers: int, episodes_per_worker: int, seed: int, minimum: float) -> dict[str, object]:
    started = time.perf_counter()
    with ProcessPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(run_worker, [(stage, seed + index * 10_000, episodes_per_worker) for index in range(workers)]))
    elapsed = time.perf_counter() - started
    episodes = sum(item[0] for item in results)
    steps = sum(item[1] for item in results)
    return {"workers": workers, "episodes": episodes, "agentSteps": steps, "wallSeconds": elapsed,
            "episodesPerSecond": episodes / elapsed, "agentStepsPerSecond": steps / elapsed,
            "gate": "COMPLETE" if steps / elapsed >= minimum else "BLOCKED"}


def run_worker(arguments: tuple[str, int, int]) -> tuple[int, int]:
    stage, seed, episodes = arguments
    completed = steps = 0
    for episode_index in range(episodes):
        current_seed = seed + episode_index
        with ParallelCurriculumEnv(stage, seed=current_seed, environment_options={
            "maxJointDecisionSteps": 80, "maxEpisodePhysicalTicks": 6_000, "maxPhysicalTicksPerStep": 600,
        }) as environment:
            observations, _ = environment.reset(seed=current_seed)
            for _ in range(80):
                masks = environment.action_masks()
                actions = {agent: int(np.flatnonzero(mask)[0]) for agent, mask in masks.items()}
                observations, _, terminated, truncated, _ = environment.step(actions)
                steps += len(actions)
                if any(terminated.values()) or any(truncated.values()):
                    break
        completed += 1
    return completed, steps


if __name__ == "__main__":
    main()

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping, Protocol, Sequence

from .fundamental_env import FUNDAMENTAL_SKILLS

PARTITION_LEVELS = {
    "TRAINING": 0.6,
    "SELECTION": 0.6,
    "EVALUATION": 0.6,
    "GENERALIZATION": 1.0,
    "REGRESSION": 0.25,
}


class RequestClient(Protocol):
    def request(self, request_type: str, payload: Mapping[str, Any] | None = None) -> Mapping[str, Any]: ...


@dataclass(frozen=True)
class FundamentalEpisodeEvidence:
    success: bool
    episode_return: float
    outcome: str
    decisions: int = 0
    physical_ticks: int = 0


EpisodeRunner = Callable[[str, str, int, float], FundamentalEpisodeEvidence]


class ModelRegistry:
    """Immutable checkpoint registry with atomic index updates."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)
        self.models_dir = self.root / "models"
        self.index_path = self.root / "models.json"
        self.models_dir.mkdir(parents=True, exist_ok=True)

    def promote(
        self,
        checkpoint_id: str,
        checkpoint_path: str | Path,
        manifest: Mapping[str, Any],
    ) -> Mapping[str, Any]:
        if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", checkpoint_id):
            raise ValueError("checkpoint_id must be a safe registry identifier")
        source = Path(checkpoint_path)
        if not source.is_file():
            raise FileNotFoundError(f"Checkpoint does not exist: {source}")
        index = self._read_index()
        if any(item["id"] == checkpoint_id for item in index["models"]):
            raise ValueError(f"Checkpoint {checkpoint_id} is already registered")
        target_dir = self.models_dir / checkpoint_id
        if target_dir.exists():
            raise ValueError(f"Checkpoint directory already exists: {target_dir}")
        target_dir.mkdir(parents=False)
        artifact = target_dir / source.name
        shutil.copy2(source, artifact)
        artifact_hash = sha256_file(artifact)
        record = {
            **dict(manifest),
            "id": checkpoint_id,
            "artifactPath": str(artifact.relative_to(self.root)).replace("\\", "/"),
            "artifactHash": f"sha256:{artifact_hash}",
        }
        atomic_write_json(target_dir / "manifest.json", record)
        updated = {"version": 1, "models": [*index["models"], record]}
        atomic_write_json(self.index_path, updated)
        return record

    def _read_index(self) -> dict[str, Any]:
        if not self.index_path.exists():
            return {"version": 1, "models": []}
        value = json.loads(self.index_path.read_text(encoding="utf-8"))
        if value.get("version") != 1 or not isinstance(value.get("models"), list):
            raise ValueError("Unsupported or corrupt model registry")
        return value


class FundamentalCurriculumManager:
    """Orchestrates evidence in Python while TypeScript owns seeds and promotion math."""

    def __init__(self, client: RequestClient, registry_root: str | Path) -> None:
        self.client = client
        self.registry = ModelRegistry(registry_root)
        self.runs_dir = Path(registry_root) / "runs"
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def prepare_plan(self, root_seed: int, counts: Mapping[str, int] | None = None) -> Mapping[str, Sequence[int]]:
        payload: dict[str, Any] = {"rootSeed": int(root_seed)}
        if counts is not None:
            payload["counts"] = dict(counts)
        return self.client.request("FUNDAMENTAL_PLAN", payload)

    def collect_evidence(
        self,
        skill: str,
        seed_partitions: Mapping[str, Sequence[int]],
        runner: EpisodeRunner,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        self._validate_skill(skill)
        evidence: list[dict[str, Any]] = []
        episodes: list[dict[str, Any]] = []
        for key, level in PARTITION_LEVELS.items():
            seeds = [int(seed) for seed in seed_partitions[key.lower()]]
            partition_results = [runner(skill, key, seed, level) for seed in seeds]
            evidence.append({
                "partition": key,
                "seeds": seeds,
                "successes": sum(1 for result in partition_results if result.success),
                "returns": [float(result.episode_return) for result in partition_results],
            })
            episodes.extend({
                "skill": skill,
                "partition": key,
                "seed": seed,
                "difficultyLevel": level,
                **asdict(result),
            } for seed, result in zip(seeds, partition_results, strict=True))
        return evidence, episodes

    def evaluate_and_promote(
        self,
        *,
        skill: str,
        root_seed: int,
        runner: EpisodeRunner,
        checkpoint_path: str | Path,
        checkpoint_id: str | None = None,
        baseline_id: str = "PPO_MASKED",
        counts: Mapping[str, int] | None = None,
        criteria: Mapping[str, Any] | None = None,
        lineage: Sequence[str] = (),
        versions: Mapping[str, Any] | None = None,
        metadata: Mapping[str, Any] | None = None,
    ) -> Mapping[str, Any]:
        self._validate_skill(skill)
        run_id = f"fundamental-{skill.lower()}-{uuid.uuid4().hex}"
        run_dir = self.runs_dir / run_id
        run_dir.mkdir(parents=False)
        seed_partitions = self.prepare_plan(root_seed, counts)
        evidence, episodes = self.collect_evidence(skill, seed_partitions, runner)
        gate_payload: dict[str, Any] = {
            "skill": skill,
            "baselineId": baseline_id,
            "seedPartitions": seed_partitions,
            "evidence": evidence,
        }
        if criteria is not None:
            gate_payload["criteria"] = dict(criteria)
        gate_response = self.client.request("FUNDAMENTAL_GATE", gate_payload)
        report = {
            "runId": run_id,
            "rootSeed": int(root_seed),
            "seedPartitions": seed_partitions,
            "episodes": episodes,
            **dict(gate_response),
        }
        atomic_write_json(run_dir / "evaluation.json", report)
        manifest = {
            "runId": run_id,
            "skill": skill,
            "baselineId": baseline_id,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "lineage": list(lineage),
            "versions": dict(versions or {}),
            "metadata": dict(metadata or {}),
            "evaluationPath": str((run_dir / "evaluation.json").relative_to(self.registry.root)).replace("\\", "/"),
            "gate": gate_response["gate"],
        }
        atomic_write_json(run_dir / "manifest.json", manifest)
        if gate_response["gate"]["state"] != "COMPLETE":
            return {"promoted": False, "runId": run_id, "gate": gate_response["gate"], "runPath": str(run_dir)}
        resolved_id = checkpoint_id or f"{skill.lower()}-{uuid.uuid4().hex[:12]}"
        record = self.registry.promote(resolved_id, checkpoint_path, manifest)
        return {"promoted": True, "runId": run_id, "gate": gate_response["gate"], "checkpoint": record, "runPath": str(run_dir)}

    @staticmethod
    def _validate_skill(skill: str) -> None:
        if skill not in FUNDAMENTAL_SKILLS:
            raise ValueError(f"Unknown fundamental skill: {skill}")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_json(path: Path, value: Mapping[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except Exception:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise

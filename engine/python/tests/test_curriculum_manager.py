from __future__ import annotations

import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from typing import Any, Mapping

from football_env.curriculum_manager import (
    FundamentalCurriculumManager,
    FundamentalEpisodeEvidence,
    ModelRegistry,
)


class FakeClient:
    def __init__(self, complete: bool = True) -> None:
        self.complete = complete
        self.requests: list[tuple[str, Mapping[str, Any]]] = []

    def request(self, request_type: str, payload: Mapping[str, Any] | None = None):
        value = dict(payload or {})
        self.requests.append((request_type, value))
        if request_type == "FUNDAMENTAL_PLAN":
            return {
                "training": [1], "selection": [2], "evaluation": [3],
                "generalization": [4], "regression": [5],
            }
        if request_type == "FUNDAMENTAL_GATE":
            return {"report": {"version": 1}, "gate": {"state": "COMPLETE" if self.complete else "READY", "reasons": [] if self.complete else ["regression"]}}
        raise AssertionError(request_type)


class CurriculumManagerTest(unittest.TestCase):
    def test_collects_authoritative_plan_and_promotes_immutable_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            checkpoint = root / "candidate.zip"
            checkpoint.write_bytes(b"deterministic-model")
            client = FakeClient(complete=True)
            manager = FundamentalCurriculumManager(client, root / "registry")

            result = manager.evaluate_and_promote(
                skill="MOVEMENT",
                root_seed=900,
                runner=lambda _skill, _partition, _seed, _level: FundamentalEpisodeEvidence(True, 1.0, "TARGET_REACHED", 2, 40),
                checkpoint_path=checkpoint,
                checkpoint_id="movement-v1",
                lineage=["bootstrap"],
                versions={"protocol": 1, "observation": 1, "actionSpace": 1, "reward": 1},
            )

            self.assertTrue(result["promoted"])
            self.assertEqual([item[0] for item in client.requests], ["FUNDAMENTAL_PLAN", "FUNDAMENTAL_GATE"])
            index = json.loads((root / "registry" / "models.json").read_text(encoding="utf-8"))
            record = index["models"][0]
            self.assertEqual(record["id"], "movement-v1")
            self.assertEqual(record["lineage"], ["bootstrap"])
            self.assertEqual(record["artifactHash"], f"sha256:{hashlib.sha256(b'deterministic-model').hexdigest()}")
            self.assertTrue((root / "registry" / record["artifactPath"]).is_file())
            self.assertTrue(Path(result["runPath"], "evaluation.json").is_file())

    def test_does_not_register_a_checkpoint_when_gate_is_not_complete(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            checkpoint = root / "candidate.zip"
            checkpoint.write_bytes(b"not-promoted")
            manager = FundamentalCurriculumManager(FakeClient(complete=False), root / "registry")
            result = manager.evaluate_and_promote(
                skill="PASSING",
                root_seed=1,
                runner=lambda *_: FundamentalEpisodeEvidence(False, -0.5, "TIMEOUT"),
                checkpoint_path=checkpoint,
                checkpoint_id="must-not-exist",
            )
            self.assertFalse(result["promoted"])
            self.assertFalse((root / "registry" / "models.json").exists())
            self.assertTrue(Path(result["runPath"], "evaluation.json").is_file())

    def test_registry_rejects_duplicate_ids(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            artifact = root / "model.zip"
            artifact.write_bytes(b"model")
            registry = ModelRegistry(root / "registry")
            registry.promote("same", artifact, {"skill": "MOVEMENT"})
            with self.assertRaisesRegex(ValueError, "already registered"):
                registry.promote("same", artifact, {"skill": "MOVEMENT"})
            with self.assertRaisesRegex(ValueError, "safe registry identifier"):
                registry.promote("../escape", artifact, {"skill": "MOVEMENT"})


if __name__ == "__main__":
    unittest.main()

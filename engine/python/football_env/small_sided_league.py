from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

from .curriculum_manager import atomic_write_json

SMALL_SIDED_LEAGUE_VERSION = 1
SMALL_SIDED_DIVISIONS = frozenset(("FIVE_V_FIVE", "SEVEN_V_SEVEN"))


class SmallSidedLeagueRegistry:
    """Persistent standings for promoted reduced-football checkpoints."""

    def __init__(self, registry_root: str | Path) -> None:
        self.path = Path(registry_root) / "small-sided-league.json"

    def register(self, checkpoint: Mapping[str, Any], division: str, rating: float = 1000.0) -> Mapping[str, Any]:
        self._validate_division(division)
        if checkpoint.get("kind") != "COLLECTIVE" or checkpoint.get("stage") != division:
            raise ValueError("league checkpoint must be COLLECTIVE and match its division")
        state = self.load()
        checkpoint_id = str(checkpoint.get("id", ""))
        if not checkpoint_id or any(entry["checkpointId"] == checkpoint_id for entry in state["entries"]):
            raise ValueError(f"invalid or duplicate checkpoint id: {checkpoint_id}")
        entry = {
            "checkpointId": checkpoint_id,
            "artifactHash": checkpoint.get("artifactHash"),
            "division": division,
            "rating": float(rating),
            "games": 0,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "goalsFor": 0,
            "goalsAgainst": 0,
        }
        updated = {**state, "entries": [*state["entries"], entry]}
        atomic_write_json(self.path, updated)
        return entry

    def record(self, division: str, home_id: str, away_id: str, home_goals: int, away_goals: int, k_factor: float = 24.0) -> Mapping[str, Any]:
        self._validate_division(division)
        if home_id == away_id or min(home_goals, away_goals) < 0:
            raise ValueError("fixture requires distinct checkpoints and non-negative goals")
        state = self.load()
        entries = [dict(entry) for entry in state["entries"]]
        home = next((entry for entry in entries if entry["checkpointId"] == home_id and entry["division"] == division), None)
        away = next((entry for entry in entries if entry["checkpointId"] == away_id and entry["division"] == division), None)
        if home is None or away is None:
            raise ValueError("unknown checkpoint in league fixture")
        home_score = 1.0 if home_goals > away_goals else 0.5 if home_goals == away_goals else 0.0
        expected = 1.0 / (1.0 + 10 ** ((away["rating"] - home["rating"]) / 400.0))
        delta = k_factor * (home_score - expected)
        self._update(home, home_goals, away_goals, home_score, delta)
        self._update(away, away_goals, home_goals, 1.0 - home_score, -delta)
        updated = {**state, "entries": entries}
        atomic_write_json(self.path, updated)
        return updated

    def standings(self, division: str) -> tuple[Mapping[str, Any], ...]:
        self._validate_division(division)
        return tuple(sorted(
            (entry for entry in self.load()["entries"] if entry["division"] == division),
            key=lambda entry: (-entry["rating"], -(entry["goalsFor"] - entry["goalsAgainst"]), entry["checkpointId"]),
        ))

    def load(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"version": SMALL_SIDED_LEAGUE_VERSION, "entries": []}
        value = json.loads(self.path.read_text(encoding="utf-8"))
        if value.get("version") != SMALL_SIDED_LEAGUE_VERSION or not isinstance(value.get("entries"), list):
            raise ValueError("unsupported or corrupt small-sided league")
        return value

    @staticmethod
    def _update(entry: dict[str, Any], goals_for: int, goals_against: int, score: float, rating_delta: float) -> None:
        entry["rating"] += rating_delta
        entry["games"] += 1
        entry["wins"] += int(score == 1.0)
        entry["draws"] += int(score == 0.5)
        entry["losses"] += int(score == 0.0)
        entry["goalsFor"] += goals_for
        entry["goalsAgainst"] += goals_against

    @staticmethod
    def _validate_division(division: str) -> None:
        if division not in SMALL_SIDED_DIVISIONS:
            raise ValueError(f"unknown small-sided division: {division}")


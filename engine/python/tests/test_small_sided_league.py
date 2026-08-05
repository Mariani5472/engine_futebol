from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from football_env.small_sided_league import SmallSidedLeagueRegistry


def checkpoint(checkpoint_id: str) -> dict[str, object]:
    return {"id": checkpoint_id, "kind": "COLLECTIVE", "stage": "FIVE_V_FIVE", "artifactHash": f"sha256:{checkpoint_id}"}


class SmallSidedLeagueRegistryTest(unittest.TestCase):
    def test_persists_ratings_and_standings_atomically(self) -> None:
        with TemporaryDirectory() as directory:
            registry = SmallSidedLeagueRegistry(Path(directory))
            registry.register(checkpoint("five-a"), "FIVE_V_FIVE")
            registry.register(checkpoint("five-b"), "FIVE_V_FIVE")
            registry.record("FIVE_V_FIVE", "five-a", "five-b", 3, 1)
            restored = SmallSidedLeagueRegistry(Path(directory))
            standings = restored.standings("FIVE_V_FIVE")
            self.assertEqual("five-a", standings[0]["checkpointId"])
            self.assertEqual(1, standings[0]["wins"])
            self.assertEqual(1, standings[1]["losses"])

    def test_rejects_checkpoint_from_wrong_stage(self) -> None:
        with TemporaryDirectory() as directory:
            registry = SmallSidedLeagueRegistry(directory)
            with self.assertRaisesRegex(ValueError, "match its division"):
                registry.register(checkpoint("five"), "SEVEN_V_SEVEN")


if __name__ == "__main__":
    unittest.main()

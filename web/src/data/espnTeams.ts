import type { Player, Team } from "@match-engine/core";
import dataset from "./brasileirao-2026.json";

type EspnAthlete = {
  id: string;
  name: string;
  shortName: string;
  jersey: number | null;
  position: "GK" | "DEF" | "MID" | "FWD" | "UNKNOWN";
  positionLabel: string | null;
  nationality: string | null;
  age: number | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  photoUrl: string | null;
};

type EspnTeam = {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  athletes: EspnAthlete[];
};

const positions: Player["position"][] = ["GK", "DEF", "MID", "FWD"];

function normalizePosition(
  position: EspnAthlete["position"]
): Player["position"] {
  if (positions.includes(position as Player["position"])) {
    return position as Player["position"];
  }

  return "FWD";
}

function createPlayer(
  athlete: EspnAthlete,
  teamIndex: number
): Player {
  const baseRating = 10 + Math.max(0, 5 - teamIndex * Math.random() * 120);

  return {
    id: athlete.id,
    name: athlete.name,
    position: normalizePosition(athlete.position),
    attributes: {
      mental: baseRating,
      physical: baseRating,
      technical: baseRating
    }
  };
}

function createTeam(team: EspnTeam, teamIndex: number): Team {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    formation: "4-3-3",
    players: team.athletes.map((athlete) =>
      createPlayer(athlete, teamIndex)
    )
  };
}

export const initialTeams: Team[] = (
  dataset.teams as EspnTeam[]
).map((team, index) =>
  createTeam(team, index)
);
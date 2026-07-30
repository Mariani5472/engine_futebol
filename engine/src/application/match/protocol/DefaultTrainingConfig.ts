import { createAttributeValue as attribute } from "../../../domain/common";
import { Pitch } from "../../../domain/pitch";
import { Player } from "../../../domain/player";
import { Referee } from "../../../domain/referee";
import { Tactic } from "../../../domain/tactics";
import { Team } from "../../../domain/team";
import type { SimulationConfig } from "../engine/SimulationConfig";

const positions = ["GK", "DC", "DC", "DL", "DR", "MC", "MC", "MC", "WL", "ST", "WR"] as const;
const roles = ["GOALKEEPER", "CENTRE_BACK", "CENTRE_BACK", "FULL_BACK", "FULL_BACK", "CENTRAL_MIDFIELDER", "CENTRAL_MIDFIELDER", "CENTRAL_MIDFIELDER", "WINGER", "STRIKER", "WINGER"] as const;
const anchors = [[4, 34], [20, 27], [20, 41], [22, 10], [22, 58], [40, 20], [38, 34], [40, 48], [48, 10], [49, 34], [48, 58]] as const;

/** Stable built-in fixture for the stdio training process, not a test import. */
export function createDefaultTrainingConfig(id: string, seed: number): SimulationConfig {
  const sharedTactic = tactic();
  return {
    id: id as never,
    homeTeam: team("home"),
    awayTeam: team("away"),
    pitch: Pitch.createStandard(),
    referee: Referee.create({ id: "training-referee" as never, name: "Training Referee", strictness: 50, consistency: 70, advantageTendency: 40 }),
    seed,
    homeTactic: sharedTactic,
    awayTactic: sharedTactic,
    tickDeltaSeconds: 0.05,
    maxDurationSeconds: 90 * 60,
    debugDecisions: false,
  };
}

function team(id: "home" | "away"): Team {
  return Team.create({
    id: id as never,
    name: id === "home" ? "Training Home" : "Training Away",
    players: positions.map((position, index) => Player.create({
      id: `${id}-${index + 1}` as never,
      name: `${id} ${index + 1}`,
      age: 25,
      preferredFoot: "RIGHT",
      positions: [position],
      positionFamiliarity: [{ position, familiarity: attribute(15) }],
      attributes: attributes() as never,
      languages: ["PT" as never],
      personality: {
        adaptability: attribute(10), ambition: attribute(10), loyalty: attribute(10),
        professionalism: attribute(10), pressure: attribute(10), sportsmanship: attribute(10), temperament: attribute(10),
      },
      relationships: [],
    })),
  });
}

function attributes(): unknown {
  const values = (keys: readonly string[]) => Object.fromEntries(keys.map(key => [key, attribute(10)]));
  return {
    mental: values(["aggression", "anticipation", "bravery", "composure", "concentration", "decisions", "determination", "flair", "leadership", "offTheBall", "positioning", "teamwork", "vision", "workRate"]),
    physical: values(["acceleration", "agility", "balance", "jumpingReach", "naturalFitness", "pace", "strength", "stamina"]),
    technical: values(["corners", "crossing", "dribbling", "finishing", "firstTouch", "freeKickTaking", "heading", "longShots", "longThrows", "marking", "passing", "penaltyTaking", "tackling", "technique"]),
    goalkeeping: values(["aerialReach", "commandOfArea", "communication", "eccentricity", "handling", "kicking", "oneOnOnes", "reflexes", "rushingOut", "tendencyToPunch", "throwing"]),
    hidden: values(["adaptability", "ambition", "consistency", "dirtiness", "importantMatches", "injuryProneness", "loyalty", "pressure", "professionalism", "sportsmanship", "temperament", "versatility"]),
  };
}

function tactic(): Tactic {
  const assignments = positions.map((position, index) => ({
    id: `slot-${index}`,
    position,
    role: roles[index],
    defensiveAnchor: { x: anchors[index][0], y: anchors[index][1] },
    attackingAnchor: { x: Math.min(82, anchors[index][0] + (index > 7 ? 28 : index > 4 ? 20 : 10)), y: anchors[index][1] },
    width: 10,
    depth: 10,
    freedom: 4,
  }));
  const shape = { name: "4-3-3", assignments };
  return Tactic.create({ defensiveShape: shape, attackingShape: shape, teamInstructions: { instructions: [] }, playerInstructions: [], familiarity: 75 });
}

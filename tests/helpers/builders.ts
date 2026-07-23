/**
 * Test fixture builders — create minimal valid domain objects for tests.
 */

import { createAttributeValue } from "../../src/domain/common";
import { Player, PlayerAttributes, MentalAttributes, PhysicalAttributes, TechnicalAttributes, GoalkeepingAttributes, HiddenAttributes } from "../../src/domain/player";
import { Team } from "../../src/domain/team";
import { Tactic, TacticalShape } from "../../src/domain/tactics";
import { Pitch } from "../../src/domain/pitch";
import { Referee } from "../../src/domain/referee";
import { Match } from "../../src/domain/match";
import { Vector2 } from "../../src/core/geometry/Vector2";
import { PlayerMatchState } from "../../src/core/movement/PlayerMatchState";
import { BallMatchState, BallState } from "../../src/core/movement/BallMatchState";
import { TeamMatchState } from "../../src/core/movement/TeamMatchState";
import { MatchState } from "../../src/core/movement/MatchState";
import { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";

const A = (v: number) => createAttributeValue(v);

function buildMentalAttributes(overrides: Partial<Record<keyof MentalAttributes, number>> = {}): MentalAttributes {
  return {
    aggression: A(overrides.aggression ?? 10),
    anticipation: A(overrides.anticipation ?? 10),
    bravery: A(overrides.bravery ?? 10),
    composure: A(overrides.composure ?? 10),
    concentration: A(overrides.concentration ?? 10),
    decisions: A(overrides.decisions ?? 10),
    determination: A(overrides.determination ?? 10),
    flair: A(overrides.flair ?? 10),
    leadership: A(overrides.leadership ?? 10),
    offTheBall: A(overrides.offTheBall ?? 10),
    positioning: A(overrides.positioning ?? 10),
    teamwork: A(overrides.teamwork ?? 10),
    vision: A(overrides.vision ?? 10),
    workRate: A(overrides.workRate ?? 10),
  };
}

function buildPhysicalAttributes(): PhysicalAttributes {
  return {
    acceleration: A(10), agility: A(10), balance: A(10),
    jumpingReach: A(10), naturalFitness: A(10), pace: A(10),
    strength: A(10), stamina: A(10),
  };
}

function buildTechnicalAttributes(overrides: Partial<Record<keyof TechnicalAttributes, number>> = {}): TechnicalAttributes {
  return {
    corners: A(overrides.corners ?? 10),
    crossing: A(overrides.crossing ?? 10),
    dribbling: A(overrides.dribbling ?? 10),
    finishing: A(overrides.finishing ?? 10),
    firstTouch: A(overrides.firstTouch ?? 10),
    freeKickTaking: A(overrides.freeKickTaking ?? 10),
    heading: A(overrides.heading ?? 10),
    longShots: A(overrides.longShots ?? 10),
    longThrows: A(overrides.longThrows ?? 10),
    marking: A(overrides.marking ?? 10),
    passing: A(overrides.passing ?? 10),
    penaltyTaking: A(overrides.penaltyTaking ?? 10),
    tackling: A(overrides.tackling ?? 10),
    technique: A(overrides.technique ?? 10),
  };
}

function buildGoalkeepingAttributes(overrides: Partial<Record<keyof GoalkeepingAttributes, number>> = {}): GoalkeepingAttributes {
  return {
    aerialReach: A(overrides.aerialReach ?? 10),
    commandOfArea: A(overrides.commandOfArea ?? 10),
    communication: A(overrides.communication ?? 10),
    eccentricity: A(overrides.eccentricity ?? 10),
    handling: A(overrides.handling ?? 10),
    kicking: A(overrides.kicking ?? 10),
    oneOnOnes: A(overrides.oneOnOnes ?? 10),
    reflexes: A(overrides.reflexes ?? 10),
    rushingOut: A(overrides.rushingOut ?? 10),
    tendencyToPunch: A(overrides.tendencyToPunch ?? 10),
    throwing: A(overrides.throwing ?? 10),
  };
}

function buildHiddenAttributes(): HiddenAttributes {
  return {
    adaptability: A(10), ambition: A(10), consistency: A(10),
    dirtiness: A(5), importantMatches: A(10), injuryProneness: A(5),
    loyalty: A(10), pressure: A(10), professionalism: A(10),
    sportsmanship: A(10), temperament: A(10), versatility: A(10),
  };
}

export function buildAttributes(
  mentalOverrides: Partial<Record<keyof MentalAttributes, number>> = {},
  technicalOverrides: Partial<Record<keyof TechnicalAttributes, number>> = {}
): PlayerAttributes {
  return {
    mental: buildMentalAttributes(mentalOverrides),
    physical: buildPhysicalAttributes(),
    technical: buildTechnicalAttributes(technicalOverrides),
    goalkeeping: buildGoalkeepingAttributes(),
    hidden: buildHiddenAttributes(),
  };
}

export function buildGoalkeeperAttributes(gkOverrides: Partial<Record<keyof GoalkeepingAttributes, number>> = {}): PlayerAttributes {
  return {
    mental: buildMentalAttributes({ positioning: 15 }),
    physical: buildPhysicalAttributes(),
    technical: buildTechnicalAttributes(),
    goalkeeping: buildGoalkeepingAttributes(gkOverrides),
    hidden: buildHiddenAttributes(),
  };
}

let playerCounter = 1;

export function buildPlayer(overrides: {
  id?: string;
  position?: string;
  role?: string;
  attributes?: PlayerAttributes;
} = {}): Player {
  const id = overrides.id ?? `player-${playerCounter++}`;
  return Player.create({
    id: id as any,
    name: `Player ${id}`,
    age: 25,
    preferredFoot: "RIGHT",
    positions: [(overrides.position ?? "MC") as any],
    positionFamiliarity: [{ position: (overrides.position ?? "MC") as any, familiarity: A(15) }],
    attributes: overrides.attributes ?? buildAttributes(),
    languages: ["EN" as any],
    personality: {
      adaptability: A(10), ambition: A(10), loyalty: A(10),
      professionalism: A(10), pressure: A(10), sportsmanship: A(10), temperament: A(10),
    },
    relationships: [],
  });
}

export function buildPlayerMatchState(overrides: {
  player?: Player;
  position?: Vector2;
  hasBall?: boolean;
  role?: string;
  fatigue?: number;
} = {}): PlayerMatchState {
  const player = overrides.player ?? buildPlayer();
  const position = overrides.position ?? new Vector2(52, 34);
  return new PlayerMatchState(
    player,
    position,
    Vector2.zero(),
    100,
    overrides.fatigue ?? 0,
    overrides.hasBall ?? false,
    (overrides.role ?? "CENTRAL_MIDFIELDER") as any,
    position,
    new Vector2(1, 0)
  );
}

/** Build a standard 4-4-2 formation. */
function buildDefaultShape(isGk: boolean = false): TacticalShape {
  const assignments = isGk
    ? [
        { id: "gk", position: "GK", role: "GOALKEEPER", defensiveAnchor: { x: 3, y: 34 }, attackingAnchor: { x: 5, y: 34 }, width: 5, depth: 5, freedom: 1 },
        { id: "dc1", position: "DC", role: "CENTRE_BACK", defensiveAnchor: { x: 20, y: 26 }, attackingAnchor: { x: 25, y: 26 }, width: 10, depth: 10, freedom: 2 },
        { id: "dc2", position: "DC", role: "CENTRE_BACK", defensiveAnchor: { x: 20, y: 42 }, attackingAnchor: { x: 25, y: 42 }, width: 10, depth: 10, freedom: 2 },
        { id: "dl", position: "DL", role: "FULL_BACK", defensiveAnchor: { x: 20, y: 10 }, attackingAnchor: { x: 30, y: 10 }, width: 8, depth: 8, freedom: 3 },
        { id: "dr", position: "DR", role: "FULL_BACK", defensiveAnchor: { x: 20, y: 58 }, attackingAnchor: { x: 30, y: 58 }, width: 8, depth: 8, freedom: 3 },
        { id: "ml", position: "ML", role: "WIDE_MIDFIELDER", defensiveAnchor: { x: 40, y: 12 }, attackingAnchor: { x: 55, y: 12 }, width: 8, depth: 8, freedom: 5 },
        { id: "mc1", position: "MC", role: "CENTRAL_MIDFIELDER", defensiveAnchor: { x: 40, y: 27 }, attackingAnchor: { x: 55, y: 27 }, width: 10, depth: 10, freedom: 4 },
        { id: "mc2", position: "MC", role: "CENTRAL_MIDFIELDER", defensiveAnchor: { x: 40, y: 41 }, attackingAnchor: { x: 55, y: 41 }, width: 10, depth: 10, freedom: 4 },
        { id: "mr", position: "MR", role: "WIDE_MIDFIELDER", defensiveAnchor: { x: 40, y: 56 }, attackingAnchor: { x: 55, y: 56 }, width: 8, depth: 8, freedom: 5 },
        { id: "st1", position: "ST", role: "STRIKER", defensiveAnchor: { x: 65, y: 30 }, attackingAnchor: { x: 75, y: 30 }, width: 12, depth: 12, freedom: 6 },
        { id: "st2", position: "ST", role: "STRIKER", defensiveAnchor: { x: 65, y: 38 }, attackingAnchor: { x: 75, y: 38 }, width: 12, depth: 12, freedom: 6 },
      ]
    : [
        { id: "mc", position: "MC", role: "CENTRAL_MIDFIELDER", defensiveAnchor: { x: 40, y: 34 }, attackingAnchor: { x: 55, y: 34 }, width: 10, depth: 10, freedom: 4 },
      ];

  return { name: "4-4-2", assignments: assignments as any };
}

export function buildTactic(): Tactic {
  const shape = buildDefaultShape(true);
  return Tactic.create({
    defensiveShape: shape,
    attackingShape: shape,
    teamInstructions: { instructions: [] },
    playerInstructions: [],
    familiarity: 75,
  });
}

export function build11Players(prefix: string): Player[] {
  const positions = [
    { position: "GK", role: "GOALKEEPER" },
    { position: "DC", role: "CENTRE_BACK" },
    { position: "DC", role: "CENTRE_BACK" },
    { position: "DL", role: "FULL_BACK" },
    { position: "DR", role: "FULL_BACK" },
    { position: "ML", role: "WIDE_MIDFIELDER" },
    { position: "MC", role: "CENTRAL_MIDFIELDER" },
    { position: "MC", role: "CENTRAL_MIDFIELDER" },
    { position: "MR", role: "WIDE_MIDFIELDER" },
    { position: "ST", role: "STRIKER" },
    { position: "ST", role: "STRIKER" },
  ];
  return positions.map((p, i) =>
    buildPlayer({ id: `${prefix}-${i + 1}`, position: p.position })
  );
}

export function buildTeam(id: string): Team {
  return Team.create({ id: id as any, name: `Team ${id}`, players: build11Players(id) });
}

export function buildPitch(): Pitch {
  return Pitch.createStandard();
}

export function buildReferee(): Referee {
  return Referee.create({
    id: "ref-1" as any,
    name: "Test Referee",
    strictness: 50,
    consistency: 70,
    advantageTendency: 40,
  });
}

export function buildSimulationConfig(seed = 42): SimulationConfig {
  const homeTeam = buildTeam("home");
  const awayTeam = buildTeam("away");
  const tactic = buildTactic();
  const pitch = buildPitch();
  const referee = buildReferee();

  return {
    id: "match-1" as any,
    homeTeam,
    awayTeam,
    pitch,
    referee,
    seed,
    homeTactic: tactic,
    awayTactic: tactic,
  };
}

export function buildMinimalMatchState(): MatchState {
  const pitch = buildPitch();

  const striker = buildPlayerMatchState({ position: new Vector2(80, 34), hasBall: true, role: "STRIKER" });
  const gk = buildPlayerMatchState({ position: new Vector2(104, 34), role: "GOALKEEPER" });

  const home = new TeamMatchState(
    buildTeam("home-mini"),
    1,
    [striker],
    buildTactic(),
    0
  );

  const away = new TeamMatchState(
    buildTeam("away-mini"),
    -1,
    [gk],
    buildTactic(),
    0
  );

  const ball = new BallMatchState(striker.position, Vector2.zero(), striker, BallState.CONTROLLED, 0);

  return new MatchState(home, away, ball, pitch, 0, home, away);
}

export const ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION = 1 as const;
export const CURRICULUM_SCENARIO_VERSION = 1 as const;
export const FUNDAMENTAL_SCENARIO_VERSION = 1 as const;

export interface ScenarioPoint {
  readonly x: number;
  readonly y: number;
}

export interface AttackerVsGoalkeeperScenarioConfig {
  readonly kind: "ATTACKER_VS_GOALKEEPER";
  readonly version: typeof ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION;
  readonly attackerId: string;
  readonly goalkeeperId: string;
  /** Exact position overrides distance/lateral configuration. */
  readonly attackerPosition?: ScenarioPoint;
  readonly goalkeeperPosition?: ScenarioPoint;
  readonly attackerDistanceFromGoal?: number;
  readonly attackerLateralOffset?: number;
  readonly goalkeeperDepthFromGoalLine?: number;
  readonly goalkeeperLateralOffset?: number;
  readonly freezeGoalkeeper?: boolean;
  readonly isolateOtherPlayers?: boolean;
}

export type CurriculumScenarioStage =
  | "PASS"
  | "TWO_V_ONE"
  | "THREE_V_TWO"
  | "FIVE_V_FIVE"
  | "LEARNED_GOALKEEPER"
  | "ELEVEN_V_ELEVEN"
  | "COLLECTIVE_POLICY"
  | "SELF_PLAY";

export type CurriculumObjective = "COMPLETE_PASS" | "SCORE_GOAL" | "PLAY_MATCH";
export type CurriculumGoalkeeperMode = "NONE" | "FROZEN" | "HEURISTIC" | "EXTERNAL";

export interface CurriculumScenarioConfig {
  readonly kind: "CURRICULUM";
  readonly version: typeof CURRICULUM_SCENARIO_VERSION;
  readonly stage: CurriculumScenarioStage;
  readonly objective: CurriculumObjective;
  readonly attackingPlayerIds: readonly string[];
  readonly defendingPlayerIds: readonly string[];
  readonly primaryBallCarrierId: string;
  readonly attackingGoalkeeperId?: string;
  readonly defendingGoalkeeperId?: string;
  readonly goalkeeperMode: CurriculumGoalkeeperMode;
  readonly isolateOtherPlayers?: boolean;
}

export type FundamentalScenarioSkill = "MOVEMENT" | "BALL_CONTROL" | "PASSING" | "SHOOTING_EMPTY_GOAL";

export interface FundamentalScenarioConfig {
  readonly kind: "FUNDAMENTAL";
  readonly version: typeof FUNDAMENTAL_SCENARIO_VERSION;
  readonly skill: FundamentalScenarioSkill;
  readonly playerId: string;
  readonly playerPosition: ScenarioPoint;
  readonly targetPosition?: ScenarioPoint;
  readonly receiverId?: string;
  readonly receiverPosition?: ScenarioPoint;
  readonly ballPosition?: ScenarioPoint;
  readonly targetRadius?: number;
  readonly isolateOtherPlayers?: boolean;
}

export type MatchScenarioConfig = AttackerVsGoalkeeperScenarioConfig | CurriculumScenarioConfig | FundamentalScenarioConfig;

export function createCurriculumScenarioPreset(stage: CurriculumScenarioStage): CurriculumScenarioConfig {
  const base = {
    kind: "CURRICULUM" as const,
    version: CURRICULUM_SCENARIO_VERSION,
    stage,
    primaryBallCarrierId: "home-10",
    isolateOtherPlayers: true,
  };
  switch (stage) {
    case "PASS": return Object.freeze({ ...base, objective: "COMPLETE_PASS", attackingPlayerIds: ["home-10", "home-9"], defendingPlayerIds: [], goalkeeperMode: "NONE" });
    case "TWO_V_ONE": return Object.freeze({ ...base, objective: "SCORE_GOAL", attackingPlayerIds: ["home-10", "home-9"], defendingPlayerIds: ["away-2"], defendingGoalkeeperId: "away-1", goalkeeperMode: "FROZEN" });
    case "THREE_V_TWO": return Object.freeze({ ...base, objective: "SCORE_GOAL", attackingPlayerIds: ["home-10", "home-9", "home-11"], defendingPlayerIds: ["away-2", "away-3"], defendingGoalkeeperId: "away-1", goalkeeperMode: "FROZEN" });
    case "FIVE_V_FIVE": return Object.freeze({ ...base, objective: "PLAY_MATCH", attackingPlayerIds: ["home-2", "home-6", "home-9", "home-10"], defendingPlayerIds: ["away-2", "away-6", "away-9", "away-10"], attackingGoalkeeperId: "home-1", defendingGoalkeeperId: "away-1", goalkeeperMode: "HEURISTIC" });
    case "LEARNED_GOALKEEPER": return Object.freeze({ ...base, objective: "SCORE_GOAL", attackingPlayerIds: ["home-10"], defendingPlayerIds: [], defendingGoalkeeperId: "away-1", goalkeeperMode: "EXTERNAL" });
    case "ELEVEN_V_ELEVEN": return Object.freeze({ ...base, objective: "PLAY_MATCH", attackingPlayerIds: fieldPlayers("home"), defendingPlayerIds: fieldPlayers("away"), attackingGoalkeeperId: "home-1", defendingGoalkeeperId: "away-1", goalkeeperMode: "HEURISTIC", isolateOtherPlayers: false });
    case "COLLECTIVE_POLICY": return Object.freeze({ ...base, objective: "PLAY_MATCH", attackingPlayerIds: fieldPlayers("home"), defendingPlayerIds: fieldPlayers("away"), attackingGoalkeeperId: "home-1", defendingGoalkeeperId: "away-1", goalkeeperMode: "HEURISTIC", isolateOtherPlayers: false });
    case "SELF_PLAY": return Object.freeze({ ...base, objective: "PLAY_MATCH", attackingPlayerIds: fieldPlayers("home"), defendingPlayerIds: fieldPlayers("away"), attackingGoalkeeperId: "home-1", defendingGoalkeeperId: "away-1", goalkeeperMode: "EXTERNAL", isolateOtherPlayers: false });
  }
}

function fieldPlayers(team: "home" | "away"): string[] {
  return Array.from({ length: 10 }, (_, index) => `${team}-${index + 2}`);
}

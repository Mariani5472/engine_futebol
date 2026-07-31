import {
  createCurriculumScenarioPreset,
  type CurriculumScenarioConfig,
  type CurriculumScenarioStage,
} from "./MatchScenario";

export const TRAINING_SCENARIO_CATALOG_VERSION = 1 as const;
export const TRAINING_SCENARIO_DEFINITION_VERSION = 1 as const;

export type TrainingScenarioFamily =
  | "PASSING"
  | "OVERLOAD"
  | "SMALL_SIDED_GAME"
  | "GOALKEEPER"
  | "FULL_MATCH";

export type TrainingPolicyMode = "SINGLE_AGENT" | "SHARED_TEAM" | "SELF_PLAY";
export type TrainingOpponentMode = "NONE" | "FROZEN" | "HEURISTIC" | "CHECKPOINT" | "OPPONENT_POOL";

export interface TrainingScenarioDefinition {
  readonly id: CurriculumScenarioStage;
  readonly family: TrainingScenarioFamily;
  readonly version: typeof TRAINING_SCENARIO_DEFINITION_VERSION;
  readonly scenario: CurriculumScenarioConfig;
  readonly controlledAgentIds: readonly string[];
  readonly policyMode: TrainingPolicyMode;
  readonly opponentMode: TrainingOpponentMode;
  readonly difficulty: Readonly<Record<string, number | boolean | string>>;
  readonly decisionIntervalTicks: number;
  readonly timeLimitSeconds: number;
  readonly terminationRules: readonly string[];
  readonly successRules: readonly string[];
  readonly rewardProfileId: string;
  readonly requiredCapabilities: readonly string[];
}

interface DefinitionInput extends Omit<TrainingScenarioDefinition, "version" | "scenario"> {}

const HOME_FIELD = Object.freeze(Array.from({ length: 10 }, (_, index) => `home-${index + 2}`));
const AWAY_FIELD = Object.freeze(Array.from({ length: 10 }, (_, index) => `away-${index + 2}`));

const define = (input: DefinitionInput): TrainingScenarioDefinition => Object.freeze({
  ...input,
  version: TRAINING_SCENARIO_DEFINITION_VERSION,
  scenario: createCurriculumScenarioPreset(input.id),
  controlledAgentIds: Object.freeze([...input.controlledAgentIds]),
  difficulty: Object.freeze({ ...input.difficulty }),
  terminationRules: Object.freeze([...input.terminationRules]),
  successRules: Object.freeze([...input.successRules]),
  requiredCapabilities: Object.freeze([...input.requiredCapabilities]),
});

const CATALOG: readonly TrainingScenarioDefinition[] = Object.freeze([
  define({
    id: "PASS", family: "PASSING", controlledAgentIds: ["home-10"], policyMode: "SINGLE_AGENT", opponentMode: "NONE",
    difficulty: { passDistanceMeters: 10 }, decisionIntervalTicks: 20, timeLimitSeconds: 12,
    terminationRules: ["PASS_RESOLVED", "TIME_LIMIT"], successRules: ["COMPLETED_PASS"],
    rewardProfileId: "PASS_V1", requiredCapabilities: ["PASS", "PHYSICAL_RECEPTION"],
  }),
  define({
    id: "TWO_V_ONE", family: "OVERLOAD", controlledAgentIds: ["home-10", "home-9"], policyMode: "SHARED_TEAM", opponentMode: "FROZEN",
    difficulty: { attackers: 2, defenders: 1, frozenGoalkeeper: true }, decisionIntervalTicks: 20, timeLimitSeconds: 15,
    terminationRules: ["GOAL", "POSSESSION_LOST", "BALL_OUT", "TIME_LIMIT"], successRules: ["GOAL"],
    rewardProfileId: "OVERLOAD_V1", requiredCapabilities: ["PASS", "CARRY", "SHOT"],
  }),
  define({
    id: "THREE_V_TWO", family: "OVERLOAD", controlledAgentIds: ["home-10", "home-9", "home-11"], policyMode: "SHARED_TEAM", opponentMode: "FROZEN",
    difficulty: { attackers: 3, defenders: 2, frozenGoalkeeper: true }, decisionIntervalTicks: 20, timeLimitSeconds: 18,
    terminationRules: ["GOAL", "POSSESSION_LOST", "BALL_OUT", "TIME_LIMIT"], successRules: ["GOAL"],
    rewardProfileId: "OVERLOAD_V1", requiredCapabilities: ["PASS", "CARRY", "SHOT", "MULTI_AGENT"],
  }),
  define({
    id: "FIVE_V_FIVE", family: "SMALL_SIDED_GAME", controlledAgentIds: ["home-1", "home-2", "home-6", "home-9", "home-10"], policyMode: "SHARED_TEAM", opponentMode: "HEURISTIC",
    difficulty: { teamSize: 5, goalkeepers: true }, decisionIntervalTicks: 20, timeLimitSeconds: 300,
    terminationRules: ["MATCH_FINISHED", "TIME_LIMIT"], successRules: ["POSITIVE_GOAL_DIFFERENCE"],
    rewardProfileId: "SMALL_SIDED_V1", requiredCapabilities: ["MULTI_AGENT", "GOALKEEPER", "RESTARTS"],
  }),
  define({
    id: "LEARNED_GOALKEEPER", family: "GOALKEEPER", controlledAgentIds: ["away-1"], policyMode: "SINGLE_AGENT", opponentMode: "CHECKPOINT",
    difficulty: { learnedGoalkeeper: true }, decisionIntervalTicks: 1, timeLimitSeconds: 12,
    terminationRules: ["SHOT_RESOLVED", "POSSESSION_LOST", "TIME_LIMIT"], successRules: ["NO_GOAL"],
    rewardProfileId: "GOALKEEPER_V1", requiredCapabilities: ["SHOT", "GOALKEEPER", "CHECKPOINT_LOADING"],
  }),
  define({
    id: "ELEVEN_V_ELEVEN", family: "FULL_MATCH", controlledAgentIds: ["home-1", ...HOME_FIELD], policyMode: "SHARED_TEAM", opponentMode: "HEURISTIC",
    difficulty: { teamSize: 11, fullMatch: true }, decisionIntervalTicks: 20, timeLimitSeconds: 5_400,
    terminationRules: ["MATCH_FINISHED"], successRules: ["POSITIVE_GOAL_DIFFERENCE"],
    rewardProfileId: "FULL_MATCH_V1", requiredCapabilities: ["MULTI_AGENT", "FULL_RULES"],
  }),
  define({
    id: "COLLECTIVE_POLICY", family: "FULL_MATCH", controlledAgentIds: ["home-1", ...HOME_FIELD], policyMode: "SHARED_TEAM", opponentMode: "CHECKPOINT",
    difficulty: { teamSize: 11, checkpointOpponent: true }, decisionIntervalTicks: 20, timeLimitSeconds: 5_400,
    terminationRules: ["MATCH_FINISHED"], successRules: ["POSITIVE_GOAL_DIFFERENCE"],
    rewardProfileId: "FULL_MATCH_V1", requiredCapabilities: ["MULTI_AGENT", "FULL_RULES", "CHECKPOINT_LOADING"],
  }),
  define({
    id: "SELF_PLAY", family: "FULL_MATCH", controlledAgentIds: ["home-1", ...HOME_FIELD, "away-1", ...AWAY_FIELD], policyMode: "SELF_PLAY", opponentMode: "OPPONENT_POOL",
    difficulty: { teamSize: 11, selfPlay: true }, decisionIntervalTicks: 20, timeLimitSeconds: 5_400,
    terminationRules: ["MATCH_FINISHED"], successRules: ["MATCH_RESULT"],
    rewardProfileId: "SELF_PLAY_V1", requiredCapabilities: ["MULTI_AGENT", "FULL_RULES", "OPPONENT_POOL"],
  }),
]);

const BY_ID = new Map(CATALOG.map(definition => [definition.id, definition]));

validateCatalog(CATALOG);

export function trainingScenarioCatalog(): readonly TrainingScenarioDefinition[] {
  return CATALOG;
}

export function trainingScenarioDefinition(id: CurriculumScenarioStage): TrainingScenarioDefinition {
  const definition = BY_ID.get(id);
  if (!definition) throw new Error(`Unknown training scenario: ${id}`);
  return definition;
}

function validateCatalog(catalog: readonly TrainingScenarioDefinition[]): void {
  const ids = new Set<string>();
  for (const definition of catalog) {
    if (ids.has(definition.id)) throw new Error(`Duplicate training scenario: ${definition.id}`);
    ids.add(definition.id);
    if (definition.scenario.stage !== definition.id) throw new Error(`Scenario ${definition.id} has a mismatched preset`);
    if (!Number.isInteger(definition.decisionIntervalTicks) || definition.decisionIntervalTicks <= 0) {
      throw new Error(`Scenario ${definition.id} requires positive decisionIntervalTicks`);
    }
    if (!Number.isFinite(definition.timeLimitSeconds) || definition.timeLimitSeconds <= 0) {
      throw new Error(`Scenario ${definition.id} requires a positive time limit`);
    }
    if (definition.terminationRules.length === 0 || definition.successRules.length === 0) {
      throw new Error(`Scenario ${definition.id} requires termination and success rules`);
    }
    if (definition.rewardProfileId.length === 0) throw new Error(`Scenario ${definition.id} requires a reward profile`);
  }
}

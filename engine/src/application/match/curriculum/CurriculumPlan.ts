import { meanConfidenceInterval, wilsonInterval } from "../evaluation/ConfidenceIntervals";
import { createCurriculumScenarioPreset, type CurriculumScenarioConfig, type CurriculumScenarioStage } from "../scenario/MatchScenario";
import { ACTOR_OBSERVATION_VERSION } from "../observation/ObservationSpace";
import { PLAYER_ACTION_SPACE_VERSION } from "../policy/PlayerActionSpace";

export const CURRICULUM_VERSION = 1 as const;

export type CurriculumPolicyMode = "SINGLE_AGENT" | "SHARED_TEAM" | "SELF_PLAY";
export type CurriculumOpponentMode = "NONE" | "FROZEN" | "HEURISTIC" | "CHECKPOINT" | "OPPONENT_POOL";
export type CurriculumCheckpointKind = "ATTACKER" | "GOALKEEPER" | "COLLECTIVE";
export type CurriculumStageState = "LOCKED" | "BLOCKED" | "READY" | "COMPLETE";

export interface CurriculumCheckpoint {
  readonly id: string;
  readonly kind: CurriculumCheckpointKind;
  readonly stage: CurriculumScenarioStage;
  readonly policyVersion: number;
  readonly observationVersion: number;
  readonly actionSpaceVersion: number;
  readonly artifactPath: string;
  readonly artifactHash: string;
  readonly createdAt: string;
}

export interface CurriculumPromotionCriteria {
  readonly minimumEpisodes: number;
  readonly minimumSuccessRateLowerBound: number;
  readonly minimumMeanReturnLowerBound: number;
  readonly maximumGeneralizationGap: number;
  readonly confidence: number;
}

export interface CurriculumStageDefinition {
  readonly index: number;
  readonly id: CurriculumScenarioStage;
  readonly scenario: CurriculumScenarioConfig;
  readonly controlledPlayerIds: readonly string[];
  readonly policyMode: CurriculumPolicyMode;
  readonly opponentMode: CurriculumOpponentMode;
  readonly requiredCheckpointKinds: readonly CurriculumCheckpointKind[];
  readonly promotion: CurriculumPromotionCriteria;
}

export interface CurriculumEvaluationReport {
  readonly stage: CurriculumScenarioStage;
  readonly evaluationSeeds: readonly number[];
  readonly successes: number;
  readonly returns: readonly number[];
  readonly trainingSuccessRate?: number;
  readonly trainingSeeds?: readonly number[];
}

export interface CurriculumGateResult {
  readonly state: CurriculumStageState;
  readonly reasons: readonly string[];
  readonly successRate?: ReturnType<typeof wilsonInterval>;
  readonly meanReturn?: ReturnType<typeof meanConfidenceInterval>;
}

const DEFAULT_PROMOTION: CurriculumPromotionCriteria = Object.freeze({
  minimumEpisodes: 100,
  minimumSuccessRateLowerBound: 0.55,
  minimumMeanReturnLowerBound: 0,
  maximumGeneralizationGap: 0.15,
  confidence: 0.95,
});

const HOME_FIELD = Object.freeze(Array.from({ length: 10 }, (_, index) => `home-${index + 2}`));
const AWAY_FIELD = Object.freeze(Array.from({ length: 10 }, (_, index) => `away-${index + 2}`));

/** The order is part of the public training contract. Never infer it from object keys. */
export const CURRICULUM_STAGE_ORDER: readonly CurriculumScenarioStage[] = Object.freeze([
  "PASS", "TWO_V_ONE", "THREE_V_TWO", "FIVE_V_FIVE", "LEARNED_GOALKEEPER",
  "ELEVEN_V_ELEVEN", "COLLECTIVE_POLICY", "SELF_PLAY",
]);

export function buildCurriculumPlan(): readonly CurriculumStageDefinition[] {
  const stage = (
    id: CurriculumScenarioStage,
    controlledPlayerIds: readonly string[],
    policyMode: CurriculumPolicyMode,
    opponentMode: CurriculumOpponentMode,
    requiredCheckpointKinds: readonly CurriculumCheckpointKind[] = [],
    promotion: Partial<CurriculumPromotionCriteria> = {},
  ): CurriculumStageDefinition => Object.freeze({
    index: CURRICULUM_STAGE_ORDER.indexOf(id),
    id,
    scenario: createCurriculumScenarioPreset(id),
    controlledPlayerIds: Object.freeze([...controlledPlayerIds]),
    policyMode,
    opponentMode,
    requiredCheckpointKinds: Object.freeze([...requiredCheckpointKinds]),
    promotion: Object.freeze({ ...DEFAULT_PROMOTION, ...promotion }),
  });

  return Object.freeze([
    stage("PASS", ["home-10"], "SINGLE_AGENT", "NONE", [], { minimumEpisodes: 50, minimumSuccessRateLowerBound: 0.70 }),
    stage("TWO_V_ONE", ["home-10", "home-9"], "SHARED_TEAM", "FROZEN", ["ATTACKER"]),
    stage("THREE_V_TWO", ["home-10", "home-9", "home-11"], "SHARED_TEAM", "FROZEN", ["ATTACKER"]),
    stage("FIVE_V_FIVE", ["home-1", "home-2", "home-6", "home-9", "home-10"], "SHARED_TEAM", "HEURISTIC", ["ATTACKER"]),
    stage("LEARNED_GOALKEEPER", ["away-1"], "SINGLE_AGENT", "CHECKPOINT", ["ATTACKER"], { minimumSuccessRateLowerBound: 0.50 }),
    stage("ELEVEN_V_ELEVEN", ["home-1", ...HOME_FIELD], "SHARED_TEAM", "HEURISTIC", ["ATTACKER", "GOALKEEPER"], { minimumEpisodes: 200, minimumSuccessRateLowerBound: 0.45 }),
    stage("COLLECTIVE_POLICY", ["home-1", ...HOME_FIELD], "SHARED_TEAM", "CHECKPOINT", ["ATTACKER", "GOALKEEPER"], { minimumEpisodes: 250, minimumSuccessRateLowerBound: 0.45 }),
    stage("SELF_PLAY", ["home-1", ...HOME_FIELD, "away-1", ...AWAY_FIELD], "SELF_PLAY", "OPPONENT_POOL", ["COLLECTIVE"], { minimumEpisodes: 500, minimumSuccessRateLowerBound: 0.45, maximumGeneralizationGap: 0.10 }),
  ]);
}

export function evaluateCurriculumGate(
  definition: CurriculumStageDefinition,
  completedStages: ReadonlySet<CurriculumScenarioStage>,
  checkpoints: readonly CurriculumCheckpoint[],
  report?: CurriculumEvaluationReport,
  opponentPoolSize = 0,
): CurriculumGateResult {
  const reasons: string[] = [];
  const previous = definition.index > 0 ? CURRICULUM_STAGE_ORDER[definition.index - 1] : undefined;
  if (previous && !completedStages.has(previous)) reasons.push(`previous stage ${previous} is incomplete`);
  for (const kind of definition.requiredCheckpointKinds) {
    const matching = checkpoints.filter(checkpoint => checkpoint.kind === kind);
    if (matching.length === 0) reasons.push(`missing ${kind} checkpoint`);
    else if (!matching.some(isCompatibleCheckpoint)) reasons.push(`no compatible ${kind} checkpoint`);
  }
  if (definition.opponentMode === "OPPONENT_POOL" && opponentPoolSize < 2) reasons.push("self-play requires at least two historical opponents");
  if (reasons.length > 0) return Object.freeze({ state: previous && !completedStages.has(previous) ? "LOCKED" : "BLOCKED", reasons });
  if (!report) return Object.freeze({ state: "READY", reasons });
  if (report.stage !== definition.id) throw new Error(`evaluation report belongs to ${report.stage}, expected ${definition.id}`);
  if (new Set(report.evaluationSeeds).size !== report.evaluationSeeds.length) reasons.push("evaluation seeds must be unique");
  if (report.trainingSeeds?.some(seed => report.evaluationSeeds.includes(seed))) reasons.push("training and evaluation seeds must be disjoint");
  if (report.evaluationSeeds.length !== report.returns.length) reasons.push("one return is required per evaluation seed");
  if (report.returns.length < definition.promotion.minimumEpisodes) reasons.push(`requires at least ${definition.promotion.minimumEpisodes} evaluation episodes`);
  if (!Number.isInteger(report.successes) || report.successes < 0 || report.successes > report.returns.length) reasons.push("success count is invalid");
  if (reasons.length > 0) return Object.freeze({ state: "READY", reasons });

  const successRate = wilsonInterval(report.successes, report.returns.length, definition.promotion.confidence);
  const meanReturn = meanConfidenceInterval(report.returns, definition.promotion.confidence);
  if (successRate.lower < definition.promotion.minimumSuccessRateLowerBound) reasons.push("success-rate confidence bound is below the promotion threshold");
  if (meanReturn.lower < definition.promotion.minimumMeanReturnLowerBound) reasons.push("mean-return confidence bound is below the promotion threshold");
  if (report.trainingSuccessRate !== undefined && report.trainingSuccessRate - successRate.estimate > definition.promotion.maximumGeneralizationGap) reasons.push("training/evaluation generalization gap is too large");
  return Object.freeze({ state: reasons.length === 0 ? "COMPLETE" : "READY", reasons, successRate, meanReturn });
}

export function isCompatibleCheckpoint(checkpoint: CurriculumCheckpoint): boolean {
  return checkpoint.policyVersion === 1
    && checkpoint.observationVersion === ACTOR_OBSERVATION_VERSION
    && checkpoint.actionSpaceVersion === PLAYER_ACTION_SPACE_VERSION
    && checkpoint.artifactPath.length > 0
    && checkpoint.artifactHash.length > 0;
}

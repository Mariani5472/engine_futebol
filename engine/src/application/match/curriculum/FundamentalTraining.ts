import { deriveSeed } from "../../../core/random/MatchRandomStreams";
import { SeededRandom } from "../../../core/random/SeededRandom";
import type { EstimateWithConfidence } from "../evaluation/ConfidenceIntervals";
import { meanConfidenceInterval, wilsonInterval } from "../evaluation/ConfidenceIntervals";
import type { BaselineAgent, BaselineDecisionContext } from "../evaluation/BaselinePolicies";
import { isCommandAllowed, randomValidBaseline } from "../evaluation/BaselinePolicies";
import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import type { PlayerActionId, PlayerActionMaskEntry } from "../policy/PlayerActionSpace";
import type {
  BallControlScenarioEnvironment,
  MovementScenarioEnvironment,
  PassingScenarioEnvironment,
  ShootingScenarioEnvironment,
  FundamentalScenarioEnvironmentOptions,
} from "../scenario/FundamentalScenarioEnvironment";
import type { FundamentalScenarioSkill } from "../scenario/MatchScenario";
import type { FundamentalScenarioOutcome } from "../scenario/contracts/FundamentalScenarioOutcome";

export const FUNDAMENTAL_TRAINING_VERSION = 1 as const;

export type FundamentalPartition = "TRAINING" | "SELECTION" | "EVALUATION" | "GENERALIZATION" | "REGRESSION";
export type FundamentalEnvironment = MovementScenarioEnvironment | BallControlScenarioEnvironment | PassingScenarioEnvironment | ShootingScenarioEnvironment;
export type FundamentalBaselineId = "RANDOM_VALID" | "SCRIPTED_SKILL" | "PPO_MASKED";

export interface FundamentalSeedPartitions {
  readonly training: readonly number[];
  readonly selection: readonly number[];
  readonly evaluation: readonly number[];
  readonly generalization: readonly number[];
  readonly regression: readonly number[];
}

export interface FundamentalSeedPartitionCounts {
  readonly training: number;
  readonly selection: number;
  readonly evaluation: number;
  readonly generalization: number;
  readonly regression: number;
}

export interface FundamentalDifficultySample {
  readonly version: typeof FUNDAMENTAL_TRAINING_VERSION;
  readonly skill: FundamentalScenarioSkill;
  readonly seed: number;
  readonly level: number;
  readonly scenario: Pick<FundamentalScenarioEnvironmentOptions,
    "playerPosition" | "targetPosition" | "receiverId" | "receiverPosition" | "ballPosition" | "targetRadius">;
  readonly parameters: Readonly<Record<string, number>>;
}

export interface FundamentalBaselineDefinition {
  readonly id: FundamentalBaselineId;
  readonly description: string;
  create(policySeed: number): BaselineAgent;
}

export interface FundamentalEpisodeRecord {
  readonly skill: FundamentalScenarioSkill;
  readonly baselineId: FundamentalBaselineId;
  readonly partition: FundamentalPartition;
  readonly scenarioSeed: number;
  readonly policySeed: number;
  readonly difficulty: FundamentalDifficultySample;
  readonly outcome: FundamentalScenarioOutcome;
  readonly success: boolean;
  readonly return: number;
  readonly decisionSteps: number;
  readonly physicalTicks: number;
}

export interface FundamentalPartitionReport {
  readonly partition: FundamentalPartition;
  readonly episodes: number;
  readonly successes: number;
  readonly successRate: EstimateWithConfidence;
  readonly meanReturn: EstimateWithConfidence;
  readonly records: readonly FundamentalEpisodeRecord[];
}

export interface FundamentalEvaluationReport {
  readonly version: typeof FUNDAMENTAL_TRAINING_VERSION;
  readonly skill: FundamentalScenarioSkill;
  readonly baselineId: FundamentalBaselineId;
  readonly confidence: number;
  readonly seedPartitions: FundamentalSeedPartitions;
  readonly partitions: readonly FundamentalPartitionReport[];
}

export interface FundamentalPromotionCriteria {
  readonly minimumEvaluationEpisodes: number;
  readonly minimumEvaluationSuccessLowerBound: number;
  readonly minimumGeneralizationSuccessLowerBound: number;
  readonly minimumRegressionSuccessLowerBound: number;
  readonly minimumEvaluationReturnLowerBound: number;
  readonly maximumSelectionEvaluationGap: number;
}

export interface FundamentalPromotionGate {
  readonly state: "READY" | "COMPLETE";
  readonly reasons: readonly string[];
}

export interface FundamentalPartitionEvidence {
  readonly partition: FundamentalPartition;
  readonly seeds: readonly number[];
  readonly successes: number;
  readonly returns: readonly number[];
}

const DEFAULT_COUNTS: FundamentalSeedPartitionCounts = Object.freeze({
  training: 1_000, selection: 100, evaluation: 200, generalization: 200, regression: 100,
});

export const DEFAULT_FUNDAMENTAL_PROMOTION: FundamentalPromotionCriteria = Object.freeze({
  minimumEvaluationEpisodes: 100,
  minimumEvaluationSuccessLowerBound: 0.8,
  minimumGeneralizationSuccessLowerBound: 0.7,
  minimumRegressionSuccessLowerBound: 0.85,
  minimumEvaluationReturnLowerBound: 0,
  maximumSelectionEvaluationGap: 0.1,
});

export function fundamentalPromotionCriteria(skill: FundamentalScenarioSkill): FundamentalPromotionCriteria {
  if (skill === "BALL_CONTROL") return Object.freeze({
    ...DEFAULT_FUNDAMENTAL_PROMOTION,
    minimumEvaluationSuccessLowerBound: .55,
    minimumGeneralizationSuccessLowerBound: .55,
    minimumRegressionSuccessLowerBound: .7,
    maximumSelectionEvaluationGap: .15,
  });
  if (skill === "SHOOTING_EMPTY_GOAL") return Object.freeze({
    ...DEFAULT_FUNDAMENTAL_PROMOTION,
    minimumEvaluationSuccessLowerBound: .25,
    minimumGeneralizationSuccessLowerBound: .2,
    minimumRegressionSuccessLowerBound: .3,
    maximumSelectionEvaluationGap: .15,
  });
  return DEFAULT_FUNDAMENTAL_PROMOTION;
}

export function createFundamentalSeedPartitions(
  rootSeed: number,
  counts: FundamentalSeedPartitionCounts = DEFAULT_COUNTS,
): FundamentalSeedPartitions {
  if (!Number.isInteger(rootSeed)) throw new Error("rootSeed must be an integer");
  const used = new Set<number>();
  const make = (partition: FundamentalPartition, count: number): readonly number[] => {
    if (!Number.isInteger(count) || count <= 0) throw new Error(`${partition} count must be a positive integer`);
    const random = new SeededRandom(deriveSeed(rootSeed, `FUNDAMENTAL_SEEDS:${partition}`));
    const result: number[] = [];
    while (result.length < count) {
      const seed = random.nextInt(1, 2_147_483_647);
      if (!used.has(seed)) { used.add(seed); result.push(seed); }
    }
    return Object.freeze(result);
  };
  return Object.freeze({
    training: make("TRAINING", counts.training),
    selection: make("SELECTION", counts.selection),
    evaluation: make("EVALUATION", counts.evaluation),
    generalization: make("GENERALIZATION", counts.generalization),
    regression: make("REGRESSION", counts.regression),
  });
}

export function sampleFundamentalDifficulty(
  skill: FundamentalScenarioSkill,
  level: number,
  seed: number,
): FundamentalDifficultySample {
  if (!(level >= 0 && level <= 1)) throw new Error("difficulty level must be in [0, 1]");
  if (!Number.isInteger(seed)) throw new Error("difficulty seed must be an integer");
  const random = new SeededRandom(deriveSeed(seed, `FUNDAMENTAL_DIFFICULTY:${skill}`));
  const lateral = random.nextFloat(-1, 1);
  const y = 34 + lateral * mix(2, 20, level);
  if (skill === "MOVEMENT") {
    const distance = mix(2, 20, level);
    const radius = mix(1.5, 0.35, level);
    return difficulty(skill, seed, level, {
      playerPosition: { x: 35, y: 34 }, targetPosition: { x: 35 + distance, y },
      ballPosition: { x: 1, y: 1 }, targetRadius: radius,
    }, { distanceMeters: distance, targetRadiusMeters: radius, lateralOffsetMeters: y - 34 });
  }
  if (skill === "BALL_CONTROL") {
    const distance = mix(0.8, 3.2, level);
    return difficulty(skill, seed, level, {
      playerPosition: { x: 48, y: 34 }, ballPosition: { x: 48 + distance, y },
    }, { ballDistanceMeters: distance, lateralOffsetMeters: y - 34 });
  }
  if (skill === "PASSING") {
    const distance = mix(4, 30, level);
    return difficulty(skill, seed, level, {
      playerPosition: { x: 35, y: 34 }, receiverId: "home-9",
      receiverPosition: { x: 35 + distance, y },
    }, { passDistanceMeters: distance, lateralOffsetMeters: y - 34 });
  }
  const distance = mix(5, 28, level);
  return difficulty(skill, seed, level, {
    playerPosition: { x: 105 - distance, y },
  }, { distanceFromGoalMeters: distance, lateralOffsetMeters: y - 34 });
}

export function selectFundamentalCurriculumLevel(
  currentLevel: number,
  rehearsalLevels: readonly number[],
  rehearsalRate: number,
  seed: number,
): number {
  const levels = [currentLevel, ...rehearsalLevels];
  if (levels.some(level => !(level >= 0 && level <= 1))) throw new Error("curriculum levels must be in [0, 1]");
  if (!(rehearsalRate >= 0 && rehearsalRate <= 1)) throw new Error("rehearsal rate must be in [0, 1]");
  if (!Number.isInteger(seed)) throw new Error("curriculum seed must be an integer");
  if (rehearsalLevels.length === 0 || rehearsalRate === 0) return currentLevel;
  const random = new SeededRandom(deriveSeed(seed, "FUNDAMENTAL_REHEARSAL"));
  if (random.nextFloat(0, 1) >= rehearsalRate) return currentLevel;
  return rehearsalLevels[random.nextInt(0, rehearsalLevels.length - 1)];
}

export function createFundamentalBaselines(skill: FundamentalScenarioSkill): readonly FundamentalBaselineDefinition[] {
  const random = randomValidBaseline();
  return Object.freeze([
    Object.freeze({ id: "RANDOM_VALID" as const, description: random.description, create: random.create }),
    scriptedFundamentalBaseline(skill),
  ]);
}

export function scriptedFundamentalBaseline(skill: FundamentalScenarioSkill): FundamentalBaselineDefinition {
  const primary: PlayerActionId = skill === "MOVEMENT" ? "MOVE"
    : skill === "BALL_CONTROL" ? "CONTROL"
    : skill === "PASSING" ? "PASS" : "SHOT";
  return Object.freeze({
    id: "SCRIPTED_SKILL" as const,
    description: `Selects ${primary} whenever legal, then the first deterministic valid command.`,
    create: (_policySeed: number): BaselineAgent => Object.freeze({
      select: ({ actionMask }: BaselineDecisionContext) => commandFor(
        actionMask.entries.find(entry => entry.id === primary && entry.enabled)
          ?? actionMask.entries.find(entry => entry.enabled && entry.validTargetIds.length > 0),
      ),
    }),
  });
}

export class FundamentalTrainingEvaluator {
  public constructor(private readonly options: {
    readonly skill: FundamentalScenarioSkill;
    readonly baseline: FundamentalBaselineDefinition;
    readonly seedPartitions: FundamentalSeedPartitions;
    readonly environmentFactory: (seed: number, difficulty: FundamentalDifficultySample) => FundamentalEnvironment;
    readonly confidence?: number;
  }) {}

  public evaluate(): FundamentalEvaluationReport {
    const confidence = this.options.confidence ?? 0.95;
    if (!(confidence > 0 && confidence < 1)) throw new Error("confidence must be in (0, 1)");
    const partitions = ([
      ["TRAINING", this.options.seedPartitions.training, 0.6],
      ["SELECTION", this.options.seedPartitions.selection, 0.6],
      ["EVALUATION", this.options.seedPartitions.evaluation, 0.6],
      ["GENERALIZATION", this.options.seedPartitions.generalization, 1],
      ["REGRESSION", this.options.seedPartitions.regression, 0.25],
    ] as const).map(([partition, seeds, level]) => this.evaluatePartition(partition, seeds, level, confidence));
    return Object.freeze({
      version: FUNDAMENTAL_TRAINING_VERSION,
      skill: this.options.skill,
      baselineId: this.options.baseline.id,
      confidence,
      seedPartitions: this.options.seedPartitions,
      partitions: Object.freeze(partitions),
    });
  }

  private evaluatePartition(partition: FundamentalPartition, seeds: readonly number[], level: number, confidence: number): FundamentalPartitionReport {
    const records = seeds.map(seed => this.runEpisode(partition, seed, level));
    const successes = records.filter(record => record.success).length;
    return Object.freeze({
      partition,
      episodes: records.length,
      successes,
      successRate: wilsonInterval(successes, records.length, confidence),
      meanReturn: meanConfidenceInterval(records.map(record => record.return), confidence),
      records: Object.freeze(records),
    });
  }

  private runEpisode(partition: FundamentalPartition, scenarioSeed: number, level: number): FundamentalEpisodeRecord {
    const difficulty = sampleFundamentalDifficulty(this.options.skill, level, scenarioSeed);
    const policySeed = deriveSeed(scenarioSeed, `FUNDAMENTAL_BASELINE:${partition}:${this.options.baseline.id}`);
    const agent = this.options.baseline.create(policySeed);
    const environment = this.options.environmentFactory(scenarioSeed, difficulty);
    const reset = environment.reset(scenarioSeed);
    let observation = reset.observation;
    let actionMask = reset.actionMask;
    let episodeReturn = 0, decisionSteps = 0, physicalTicks = reset.info.physicalTicks;
    let outcome: FundamentalScenarioOutcome | null = null;
    while (!environment.isDone()) {
      const command = agent.select({ observation, actionMask, decisionStep: decisionSteps });
      if (!isCommandAllowed(command, actionMask)) throw new Error(`${this.options.baseline.id} selected a masked command`);
      const transition = environment.step(command);
      episodeReturn += transition.reward;
      decisionSteps++;
      physicalTicks += transition.info.physicalTicks;
      outcome = transition.outcome;
      observation = transition.observation;
      actionMask = transition.actionMask;
    }
    outcome ??= "TIMEOUT";
    return Object.freeze({
      skill: this.options.skill, baselineId: this.options.baseline.id, partition,
      scenarioSeed, policySeed, difficulty, outcome,
      success: isFundamentalSuccess(this.options.skill, outcome),
      return: episodeReturn, decisionSteps, physicalTicks,
    });
  }
}

export function evaluateFundamentalPromotionGate(
  report: FundamentalEvaluationReport,
  criteria: FundamentalPromotionCriteria = DEFAULT_FUNDAMENTAL_PROMOTION,
): FundamentalPromotionGate {
  const reasons: string[] = [];
  const partition = (id: FundamentalPartition) => {
    const found = report.partitions.find(item => item.partition === id);
    if (!found) throw new Error(`Missing ${id} partition`);
    return found;
  };
  const selection = partition("SELECTION"), evaluation = partition("EVALUATION");
  const generalization = partition("GENERALIZATION"), regression = partition("REGRESSION");
  if (evaluation.episodes < criteria.minimumEvaluationEpisodes) reasons.push("insufficient evaluation episodes");
  if (evaluation.successRate.lower < criteria.minimumEvaluationSuccessLowerBound) reasons.push("evaluation success lower bound is below threshold");
  if (generalization.successRate.lower < criteria.minimumGeneralizationSuccessLowerBound) reasons.push("generalization success lower bound is below threshold");
  if (regression.successRate.lower < criteria.minimumRegressionSuccessLowerBound) reasons.push("regression success lower bound is below threshold");
  if (evaluation.meanReturn.lower < criteria.minimumEvaluationReturnLowerBound) reasons.push("evaluation return lower bound is below threshold");
  if (selection.successRate.estimate - evaluation.successRate.estimate > criteria.maximumSelectionEvaluationGap) reasons.push("selection/evaluation gap is too large");
  return Object.freeze({ state: reasons.length === 0 ? "COMPLETE" : "READY", reasons: Object.freeze(reasons) });
}

export function buildFundamentalReportFromEvidence(input: {
  readonly skill: FundamentalScenarioSkill;
  readonly baselineId: FundamentalBaselineId;
  readonly seedPartitions: FundamentalSeedPartitions;
  readonly evidence: readonly FundamentalPartitionEvidence[];
  readonly confidence?: number;
}): FundamentalEvaluationReport {
  const confidence = input.confidence ?? 0.95;
  const expected: Record<FundamentalPartition, readonly number[]> = {
    TRAINING: input.seedPartitions.training,
    SELECTION: input.seedPartitions.selection,
    EVALUATION: input.seedPartitions.evaluation,
    GENERALIZATION: input.seedPartitions.generalization,
    REGRESSION: input.seedPartitions.regression,
  };
  const partitions = (Object.keys(expected) as FundamentalPartition[]).map(partition => {
    const evidence = input.evidence.find(item => item.partition === partition);
    if (!evidence) throw new Error(`Missing ${partition} evidence`);
    if (evidence.seeds.length !== evidence.returns.length) throw new Error(`${partition} requires one return per seed`);
    if (evidence.successes < 0 || evidence.successes > evidence.seeds.length || !Number.isInteger(evidence.successes)) {
      throw new Error(`${partition} successes are invalid`);
    }
    if (evidence.seeds.some((seed, index) => seed !== expected[partition][index])) {
      throw new Error(`${partition} evidence seeds do not match the authoritative plan`);
    }
    return Object.freeze({
      partition,
      episodes: evidence.seeds.length,
      successes: evidence.successes,
      successRate: wilsonInterval(evidence.successes, evidence.seeds.length, confidence),
      meanReturn: meanConfidenceInterval(evidence.returns, confidence),
      records: Object.freeze([]),
    });
  });
  return Object.freeze({
    version: FUNDAMENTAL_TRAINING_VERSION,
    skill: input.skill,
    baselineId: input.baselineId,
    confidence,
    seedPartitions: input.seedPartitions,
    partitions: Object.freeze(partitions),
  });
}

export function isFundamentalSuccess(skill: FundamentalScenarioSkill, outcome: FundamentalScenarioOutcome): boolean {
  return skill === "MOVEMENT" ? outcome === "TARGET_REACHED"
    : skill === "BALL_CONTROL" ? outcome === "BALL_CONTROLLED"
    : skill === "PASSING" ? outcome === "PASS_COMPLETED"
    : outcome === "GOAL";
}

function difficulty(
  skill: FundamentalScenarioSkill,
  seed: number,
  level: number,
  scenario: FundamentalDifficultySample["scenario"],
  parameters: Record<string, number>,
): FundamentalDifficultySample {
  return Object.freeze({ version: FUNDAMENTAL_TRAINING_VERSION, skill, seed, level, scenario: Object.freeze(scenario), parameters: Object.freeze(parameters) });
}

function mix(easy: number, hard: number, level: number): number { return easy + (hard - easy) * level; }

function commandFor(entry: PlayerActionMaskEntry | undefined): PlayerActionCommand {
  if (!entry) throw new Error("Action mask contains no valid command");
  const targetId = [...entry.validTargetIds].sort((a, b) => a === b ? 0 : a === null ? -1 : b === null ? 1 : a.localeCompare(b))[0];
  if (targetId === undefined) throw new Error(`Enabled action ${entry.id} has no target variant`);
  return targetId === null ? Object.freeze({ actionId: entry.id }) : Object.freeze({ actionId: entry.id, targetId });
}

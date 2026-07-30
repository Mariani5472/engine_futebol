import { deriveSeed } from "../../../core/random/MatchRandomStreams";
import {
  type AttackerVsGoalkeeperEnvironment,
  type AttackerVsGoalkeeperOutcome,
} from "../scenario/AttackerVsGoalkeeperEnvironment";
import {
  createDefaultBaselines,
  isCommandAllowed,
  type BaselineDefinition,
  type BaselineId,
} from "./BaselinePolicies";
import { meanConfidenceInterval, wilsonInterval, type EstimateWithConfidence } from "./ConfidenceIntervals";
import { validateEvaluationSeedSplit, type EvaluationSeedSplit } from "./SeedSplit";

export const INTERNAL_BASELINE_EVALUATION_VERSION = 1 as const;

export type EvaluationPartition = "DEVELOPMENT" | "EVALUATION";

export const ATTACKER_VS_GOALKEEPER_OUTCOMES: readonly AttackerVsGoalkeeperOutcome[] = Object.freeze([
  "GOAL", "SAVED_CAUGHT", "SAVED_PARRIED", "BLOCKED", "OFF_TARGET", "POST", "CROSSBAR",
  "POSSESSION_LOST", "TIMEOUT",
]);

export interface BaselineEpisodeRecord {
  readonly baselineId: BaselineId;
  readonly partition: EvaluationPartition;
  readonly scenarioSeed: number;
  readonly policySeed: number;
  readonly outcome: AttackerVsGoalkeeperOutcome;
  readonly goal: boolean;
  readonly onTarget: boolean;
  readonly semanticCompletion: boolean;
  readonly decisionSteps: number;
  readonly physicalTicks: number;
  readonly return: number;
  readonly terminated: boolean;
  readonly truncated: boolean;
}

export interface BaselinePartitionReport {
  readonly baselineId: BaselineId;
  readonly description: string;
  readonly partition: EvaluationPartition;
  readonly episodes: number;
  readonly outcomeCounts: Readonly<Record<AttackerVsGoalkeeperOutcome, number>>;
  readonly outcomeRates: Readonly<Record<AttackerVsGoalkeeperOutcome, EstimateWithConfidence>>;
  readonly goalRate: EstimateWithConfidence;
  readonly onTargetRate: EstimateWithConfidence;
  readonly semanticCompletionRate: EstimateWithConfidence;
  readonly decisionSteps: EstimateWithConfidence;
  readonly physicalTicks: EstimateWithConfidence;
  readonly return: EstimateWithConfidence;
  readonly records: readonly BaselineEpisodeRecord[];
}

export interface InternalBaselineEvaluationReport {
  readonly version: typeof INTERNAL_BASELINE_EVALUATION_VERSION;
  readonly confidenceLevel: number;
  readonly seedSplit: EvaluationSeedSplit;
  readonly baselineIds: readonly BaselineId[];
  readonly reports: readonly BaselinePartitionReport[];
}

export interface InternalBaselineEvaluatorOptions {
  /** A fresh environment must be returned for every episode. */
  readonly environmentFactory: (scenarioSeed: number) => AttackerVsGoalkeeperEnvironment;
  readonly seedSplit: EvaluationSeedSplit;
  readonly baselines?: readonly BaselineDefinition[];
  readonly confidenceLevel?: number;
}

/**
 * Paired evaluator: every baseline receives the same scenario seeds. Policy
 * randomness is derived into a separate stream and cannot shift engine RNGs.
 */
export class InternalBaselineEvaluator {
  private readonly split: EvaluationSeedSplit;
  private readonly baselines: readonly BaselineDefinition[];
  private readonly confidence: number;

  public constructor(private readonly options: InternalBaselineEvaluatorOptions) {
    this.split = validateEvaluationSeedSplit(options.seedSplit);
    this.baselines = Object.freeze([...(options.baselines ?? createDefaultBaselines())]);
    if (this.baselines.length === 0) throw new Error("At least one baseline is required");
    const ids = this.baselines.map(baseline => baseline.id);
    if (new Set(ids).size !== ids.length) throw new Error("Baseline IDs must be unique");
    this.confidence = options.confidenceLevel ?? 0.95;
    if (!(this.confidence > 0 && this.confidence < 1)) throw new Error("confidenceLevel must be in (0, 1)");
  }

  public evaluate(): InternalBaselineEvaluationReport {
    const reports: BaselinePartitionReport[] = [];
    for (const baseline of this.baselines) {
      if (this.split.development.length > 0) {
        reports.push(this.evaluatePartition(baseline, "DEVELOPMENT", this.split.development));
      }
      if (this.split.evaluation.length > 0) {
        reports.push(this.evaluatePartition(baseline, "EVALUATION", this.split.evaluation));
      }
    }
    return Object.freeze({
      version: INTERNAL_BASELINE_EVALUATION_VERSION,
      confidenceLevel: this.confidence,
      seedSplit: this.split,
      baselineIds: Object.freeze(this.baselines.map(baseline => baseline.id)),
      reports: Object.freeze(reports),
    });
  }

  private evaluatePartition(
    baseline: BaselineDefinition,
    partition: EvaluationPartition,
    seeds: readonly number[],
  ): BaselinePartitionReport {
    const records = seeds.map(seed => this.runEpisode(baseline, partition, seed));
    const outcomeCounts = Object.fromEntries(ATTACKER_VS_GOALKEEPER_OUTCOMES.map(outcome => [
      outcome, records.filter(record => record.outcome === outcome).length,
    ])) as Record<AttackerVsGoalkeeperOutcome, number>;
    const outcomeRates = Object.fromEntries(ATTACKER_VS_GOALKEEPER_OUTCOMES.map(outcome => [
      outcome, wilsonInterval(outcomeCounts[outcome], records.length, this.confidence),
    ])) as Record<AttackerVsGoalkeeperOutcome, EstimateWithConfidence>;
    return Object.freeze({
      baselineId: baseline.id,
      description: baseline.description,
      partition,
      episodes: records.length,
      outcomeCounts: Object.freeze(outcomeCounts),
      outcomeRates: Object.freeze(outcomeRates),
      goalRate: wilsonInterval(records.filter(record => record.goal).length, records.length, this.confidence),
      onTargetRate: wilsonInterval(records.filter(record => record.onTarget).length, records.length, this.confidence),
      semanticCompletionRate: wilsonInterval(records.filter(record => record.semanticCompletion).length, records.length, this.confidence),
      decisionSteps: meanConfidenceInterval(records.map(record => record.decisionSteps), this.confidence),
      physicalTicks: meanConfidenceInterval(records.map(record => record.physicalTicks), this.confidence),
      return: meanConfidenceInterval(records.map(record => record.return), this.confidence),
      records: Object.freeze(records),
    });
  }

  private runEpisode(
    baseline: BaselineDefinition,
    partition: EvaluationPartition,
    scenarioSeed: number,
  ): BaselineEpisodeRecord {
    const policySeed = deriveSeed(scenarioSeed, `BASELINE_POLICY:${partition}:${baseline.id}`);
    const agent = baseline.create(policySeed);
    const environment = this.options.environmentFactory(scenarioSeed);
    const reset = environment.reset(scenarioSeed);
    let observation = reset.observation;
    let actionMask = reset.actionMask;
    let decisionSteps = 0;
    let physicalTicks = reset.info.physicalTicks;
    let episodeReturn = 0;
    let outcome: AttackerVsGoalkeeperOutcome | null = null;
    let terminated = false;
    let truncated = false;
    while (!terminated && !truncated) {
      const command = agent.select({
        observation,
        actionMask,
        decisionStep: decisionSteps,
      });
      if (!isCommandAllowed(command, actionMask)) {
        throw new Error(`Baseline ${baseline.id} selected a masked command for scenario seed ${scenarioSeed}`);
      }
      let transition;
      try {
        transition = environment.step(command);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Baseline ${baseline.id} failed in ${partition}, scenario seed ${scenarioSeed}, decision ${decisionSteps}, command ${JSON.stringify(command)}: ${detail}`);
      }
      decisionSteps++;
      physicalTicks += transition.info.physicalTicks;
      episodeReturn += transition.reward;
      outcome = transition.outcome;
      terminated = transition.terminated;
      truncated = transition.truncated;
      observation = transition.observation;
      actionMask = transition.actionMask;
    }
    if (outcome === null) outcome = "TIMEOUT";
    return Object.freeze({
      baselineId: baseline.id,
      partition,
      scenarioSeed,
      policySeed,
      outcome,
      goal: outcome === "GOAL",
      onTarget: outcome === "GOAL" || outcome === "SAVED_CAUGHT" || outcome === "SAVED_PARRIED",
      semanticCompletion: outcome !== "TIMEOUT",
      decisionSteps,
      physicalTicks,
      return: episodeReturn,
      terminated,
      truncated,
    });
  }
}

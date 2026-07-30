import { SeededRandom } from "../../../core/random/SeededRandom";
import { deriveSeed } from "../../../core/random/MatchRandomStreams";

export interface EvaluationSeedSplit {
  readonly development: readonly number[];
  readonly evaluation: readonly number[];
}

export function createEvaluationSeedSplit(
  rootSeed: number,
  developmentCount: number,
  evaluationCount: number,
): EvaluationSeedSplit {
  if (!Number.isInteger(rootSeed)) throw new Error("rootSeed must be an integer");
  validateCount(developmentCount, "developmentCount");
  validateCount(evaluationCount, "evaluationCount");
  if (developmentCount + evaluationCount === 0) throw new Error("At least one seed is required");
  const used = new Set<number>();
  const development = generateUnique(deriveSeed(rootSeed, "BASELINE_SEEDS:DEVELOPMENT"), developmentCount, used);
  const evaluation = generateUnique(deriveSeed(rootSeed, "BASELINE_SEEDS:EVALUATION"), evaluationCount, used);
  return validateEvaluationSeedSplit({ development, evaluation });
}

export function validateEvaluationSeedSplit(split: EvaluationSeedSplit): EvaluationSeedSplit {
  const development = validatePartition(split.development, "development");
  const evaluation = validatePartition(split.evaluation, "evaluation");
  const developmentSet = new Set(development);
  const overlap = evaluation.find(seed => developmentSet.has(seed));
  if (overlap !== undefined) throw new Error(`Seed ${overlap} occurs in both development and evaluation partitions`);
  if (development.length + evaluation.length === 0) throw new Error("At least one seed is required");
  return Object.freeze({ development: Object.freeze(development), evaluation: Object.freeze(evaluation) });
}

function generateUnique(seed: number, count: number, used: Set<number>): number[] {
  const random = new SeededRandom(seed);
  const result: number[] = [];
  while (result.length < count) {
    const candidate = random.nextInt(1, 2_147_483_647);
    if (!used.has(candidate)) {
      used.add(candidate);
      result.push(candidate);
    }
  }
  return result;
}

function validatePartition(seeds: readonly number[], name: string): number[] {
  const copy = [...seeds];
  if (copy.some(seed => !Number.isInteger(seed))) throw new Error(`${name} seeds must be integers`);
  if (new Set(copy).size !== copy.length) throw new Error(`${name} partition contains duplicate seeds`);
  return copy;
}

function validateCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
}

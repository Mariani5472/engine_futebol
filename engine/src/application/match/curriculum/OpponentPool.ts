import { SeededRandom } from "../../../core/random/SeededRandom";
import type { CurriculumCheckpoint } from "./CurriculumPlan";

export const OPPONENT_POOL_VERSION = 1 as const;

export interface OpponentPoolEntry {
  readonly checkpoint: CurriculumCheckpoint;
  readonly rating: number;
  readonly games: number;
  readonly generation: number;
}

export interface SelfPlayPairing {
  readonly learnerCheckpointId: string;
  readonly opponent: OpponentPoolEntry;
  readonly seed: number;
}

/** Metadata-only pool. Model artifacts are immutable and loaded by the training process. */
export class OpponentPool {
  private readonly entries = new Map<string, OpponentPoolEntry>();

  public add(checkpoint: CurriculumCheckpoint, generation: number, rating = 1_000): void {
    if (checkpoint.kind !== "COLLECTIVE") throw new Error("self-play accepts only COLLECTIVE checkpoints");
    if (!Number.isInteger(generation) || generation < 0) throw new Error("generation must be a non-negative integer");
    if (this.entries.has(checkpoint.id)) throw new Error(`checkpoint ${checkpoint.id} is already in the opponent pool`);
    this.entries.set(checkpoint.id, Object.freeze({ checkpoint: Object.freeze({ ...checkpoint }), rating, games: 0, generation }));
  }

  public list(): readonly OpponentPoolEntry[] {
    return Object.freeze([...this.entries.values()].sort((left, right) => left.generation - right.generation || left.checkpoint.id.localeCompare(right.checkpoint.id)));
  }

  /** Deterministic mixture: 50% latest, 25% rating-near, 25% historical uniform. */
  public sample(learnerCheckpointId: string, learnerRating: number, seed: number): SelfPlayPairing {
    const candidates = this.list().filter(entry => entry.checkpoint.id !== learnerCheckpointId);
    if (candidates.length === 0) throw new Error("self-play requires at least one opponent distinct from the learner");
    const random = new SeededRandom(seed);
    const draw = random.next();
    let opponent: OpponentPoolEntry;
    if (draw < 0.5) {
      opponent = candidates.reduce((latest, entry) => entry.generation > latest.generation ? entry : latest);
    } else if (draw < 0.75) {
      opponent = candidates.reduce((nearest, entry) => Math.abs(entry.rating - learnerRating) < Math.abs(nearest.rating - learnerRating) ? entry : nearest);
    } else {
      opponent = candidates[random.nextInt(0, candidates.length - 1)];
    }
    return Object.freeze({ learnerCheckpointId, opponent, seed });
  }

  public recordResult(checkpointId: string, score: 0 | 0.5 | 1, opponentRating: number, kFactor = 24): OpponentPoolEntry {
    const current = this.entries.get(checkpointId);
    if (!current) throw new Error(`unknown opponent checkpoint ${checkpointId}`);
    const expected = 1 / (1 + 10 ** ((opponentRating - current.rating) / 400));
    const updated = Object.freeze({ ...current, rating: current.rating + kFactor * (score - expected), games: current.games + 1 });
    this.entries.set(checkpointId, updated);
    return updated;
  }
}


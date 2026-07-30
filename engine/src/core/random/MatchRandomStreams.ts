import { SeededRandom } from "./SeededRandom";

export type MatchRandomStreamName = "ACTION" | "COGNITION" | "POSSESSION" | "REFEREE";

export interface MatchRandomStreams {
  readonly action: SeededRandom;
  readonly cognition: SeededRandom;
  readonly possession: SeededRandom;
  readonly referee: SeededRandom;
}

/**
 * Produces independent deterministic streams from a match seed. Consuming one
 * subsystem's random values can no longer shift another subsystem's sequence.
 */
export function createMatchRandomStreams(seed: number): MatchRandomStreams {
  return {
    action: createStream(seed, "ACTION"),
    cognition: createStream(seed, "COGNITION"),
    possession: createStream(seed, "POSSESSION"),
    referee: createStream(seed, "REFEREE"),
  };
}

export function createStream(seed: number, namespace: MatchRandomStreamName): SeededRandom {
  return new SeededRandom(deriveSeed(seed, namespace));
}

export function deriveSeed(seed: number, namespace: string): number {
  let hash = (2166136261 ^ (seed | 0)) >>> 0;
  for (let index = 0; index < namespace.length; index++) {
    hash ^= namespace.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  // Mulberry32 accepts signed or unsigned 32-bit values; normalize explicitly.
  return hash | 0;
}

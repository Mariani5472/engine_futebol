import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { createMatchRandomStreams } from "../../../src/core/random/MatchRandomStreams";

describe("SeededRandom", () => {
  it("produces values in [0, 1)", () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic — same seed gives same sequence", () => {
    const rng1 = new SeededRandom(12345);
    const rng2 = new SeededRandom(12345);
    for (let i = 0; i < 20; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  it("different seeds produce different sequences", () => {
    const rng1 = new SeededRandom(1);
    const rng2 = new SeededRandom(2);
    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());
    expect(seq1).not.toEqual(seq2);
  });

  it("nextFloat returns values within [min, max]", () => {
    const rng = new SeededRandom(99);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextFloat(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });

  it("nextInt returns integer values within [min, max]", () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 100; i++) {
      const v = rng.nextInt(0, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe("MatchRandomStreams", () => {
  it("derives repeatable but distinct subsystem streams", () => {
    const first = createMatchRandomStreams(42);
    const second = createMatchRandomStreams(42);
    expect(first.action.next()).toBe(second.action.next());
    expect(first.cognition.next()).toBe(second.cognition.next());
    expect(first.action.next()).not.toBe(first.cognition.next());
  });

  it("keeps action randomness unchanged when another subsystem consumes values", () => {
    const untouched = createMatchRandomStreams(99);
    const noisy = createMatchRandomStreams(99);
    for (let index = 0; index < 100; index++) noisy.cognition.next();
    for (let index = 0; index < 20; index++) {
      expect(noisy.action.next()).toBe(untouched.action.next());
    }
  });
});

import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../helpers/builders";
import { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";

/**
 * Integration tests run a 90-minute match using large 10-second ticks
 * (540 total iterations instead of 10 800) so the suite stays within Jest's
 * timeout budget while exercising the full engine pipeline.
 */
function fastConfig(seed: number): SimulationConfig {
  return { ...buildSimulationConfig(seed), tickDeltaSeconds: 10 };
}

describe("MatchEngine — full match simulation", () => {

  const engine = new MatchEngine();

  it("completes a 90-minute match without throwing", () => {
    expect(() => engine.simulate(fastConfig(42))).not.toThrow();
  });

  it("returns a result with the correct team IDs", () => {
    const result = engine.simulate(fastConfig(1));
    expect(result.homeTeamId).toBe("home");
    expect(result.awayTeamId).toBe("away");
  });

  it("always emits PERIOD_STARTED and PERIOD_ENDED events", () => {
    const result = engine.simulate(fastConfig(7));
    const types = result.events.map(e => e.type);
    expect(types).toContain("PERIOD_STARTED");
    expect(types).toContain("PERIOD_ENDED");
  });

  it("emits exactly two PERIOD_STARTED events (first half + second half)", () => {
    const result = engine.simulate(fastConfig(8));
    const starts = result.events.filter(e => e.type === "PERIOD_STARTED");
    expect(starts).toHaveLength(2);
  });

  it("produces non-negative scores", () => {
    const result = engine.simulate(fastConfig(99));
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
  });

  it("match duration equals 90 minutes in seconds", () => {
    const result = engine.simulate(fastConfig(3));
    expect(result.matchDurationSeconds).toBeCloseTo(90 * 60, 0);
  });

  it("goal events count matches total score", () => {
    const result = engine.simulate(fastConfig(10));
    const goals = result.events.filter(e => e.type === "GOAL");
    expect(goals.length).toBe(result.homeScore + result.awayScore);
  });

  it("seed is echoed in the result", () => {
    const result = engine.simulate(fastConfig(123));
    expect(result.seed).toBe(123);
  });

  it("homeShots and awayShots are non-negative integers", () => {
    const result = engine.simulate(fastConfig(55));
    expect(result.homeShots).toBeGreaterThanOrEqual(0);
    expect(result.awayShots).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.homeShots)).toBe(true);
    expect(Number.isInteger(result.awayShots)).toBe(true);
  });

});

describe("MatchEngine — determinism", () => {

  const engine = new MatchEngine();

  it("same seed produces identical score", () => {
    const r1 = engine.simulate(fastConfig(42));
    const r2 = engine.simulate(fastConfig(42));
    expect(r1.homeScore).toBe(r2.homeScore);
    expect(r1.awayScore).toBe(r2.awayScore);
  });

  it("same seed produces identical event count", () => {
    const r1 = engine.simulate(fastConfig(77));
    const r2 = engine.simulate(fastConfig(77));
    expect(r1.events.length).toBe(r2.events.length);
  });

  it("same seed produces identical shot counts", () => {
    const r1 = engine.simulate(fastConfig(5));
    const r2 = engine.simulate(fastConfig(5));
    expect(r1.homeShots).toBe(r2.homeShots);
    expect(r1.awayShots).toBe(r2.awayShots);
  });

});

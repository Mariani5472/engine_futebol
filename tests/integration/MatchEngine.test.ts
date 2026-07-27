import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../helpers/builders";
import { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";

/**
 * Fast integration ticks — large delta keeps the suite inside Jest timeout
 * while still exercising the full engine pipeline (decision → pipeline →
 * arbitration → physics).
 */
function fastConfig(seed: number): SimulationConfig {
  return {
    ...buildSimulationConfig(seed),
    tickDeltaSeconds: 2,
    maxDurationSeconds: 90 * 60,
  };
}

describe("MatchEngine — full match simulation", () => {
  const engine = new MatchEngine();

  it("completes a 90-minute match without throwing", () => {
    expect(() => engine.simulate(fastConfig(42))).not.toThrow();
  }, 120_000);

  it("returns a result with the correct team IDs", () => {
    const result = engine.simulate(fastConfig(1));
    expect(result.homeTeamId).toBe("home");
    expect(result.awayTeamId).toBe("away");
  }, 120_000);

  it("always emits PERIOD_STARTED and PERIOD_ENDED events", () => {
    const result = engine.simulate(fastConfig(7));
    const types = result.events.map((e) => e.type);
    expect(types).toContain("PERIOD_STARTED");
    expect(types).toContain("PERIOD_ENDED");
  }, 120_000);

  it("produces non-negative scores and shot counts", () => {
    const result = engine.simulate(fastConfig(99));
    expect(result.homeScore).toBeGreaterThanOrEqual(0);
    expect(result.awayScore).toBeGreaterThanOrEqual(0);
    expect(result.homeShots).toBeGreaterThanOrEqual(0);
    expect(result.awayShots).toBeGreaterThanOrEqual(0);
  }, 120_000);

  it("echoes the seed in the result", () => {
    const result = engine.simulate(fastConfig(123));
    expect(result.seed).toBe(123);
  }, 120_000);
});

describe("MatchEngine — determinism", () => {
  const engine = new MatchEngine();

  it("same seed produces identical score", () => {
    const r1 = engine.simulate(fastConfig(42));
    const r2 = engine.simulate(fastConfig(42));
    expect(r1.homeScore).toBe(r2.homeScore);
    expect(r1.awayScore).toBe(r2.awayScore);
  }, 120_000);
});

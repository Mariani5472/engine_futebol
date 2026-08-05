import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../helpers/builders";
import { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";

/**
 * Fast integration ticks — large delta keeps the suite inside Jest timeout
 * while still exercising the full engine pipeline (decision → pipeline →
 * arbitration → physics → metrics).
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

  it("populates Phase 9 metrics (shots, possession, xG)", () => {
    const result = engine.simulate(fastConfig(42));
    expect(result.metrics).toBeDefined();
    expect(result.metrics.home.shots + result.metrics.away.shots).toBe(
      result.homeShots + result.awayShots,
    );
    expect(result.metrics.home.possessionPercent + result.metrics.away.possessionPercent).toBeCloseTo(
      100,
      0,
    );
    expect(result.metrics.totalGoals).toBe(result.homeScore + result.awayScore);
    expect(result.metrics.home.xG).toBeGreaterThanOrEqual(0);
    expect(result.metrics.away.xG).toBeGreaterThanOrEqual(0);
    expect(result.metrics.home.shots).toBe(result.analytics.teams.home.shots);
    expect(result.metrics.away.shots).toBe(result.analytics.teams.away.shots);
    expect(result.metrics.home.fouls).toBe(result.analytics.teams.home.fouls);
    expect(result.metrics.away.fouls).toBe(result.analytics.teams.away.fouls);
    expect(result.metrics.home.passes).toBe(result.analytics.teams.home.passesAttempted);
    expect(result.metrics.away.passes).toBe(result.analytics.teams.away.passesAttempted);
  }, 120_000);

  it("publishes unique event ids and causal action ids for action events", () => {
    const result = engine.simulate(fastConfig(42));
    expect(new Set(result.eventStore.map(event => event.id)).size).toBe(result.eventStore.length);
    const actionEvents = result.eventStore.filter(event =>
      ["PASS_ATTEMPTED", "SHOT", "TACKLE", "FOUL"].includes(event.type),
    );
    expect(actionEvents.length).toBeGreaterThan(0);
    expect(actionEvents.every(event => Boolean(event.actionId))).toBe(true);
    const shotIds = new Set(result.eventStore.filter(event => event.type === "SHOT").map(event => event.id));
    const resolvedShotIds = result.eventStore
      .filter(event => event.type === "SHOT_RESOLVED")
      .map(event => String(event.metadata.shotId));
    expect(resolvedShotIds.every(shotId => shotIds.has(shotId))).toBe(true);
    const interceptions = result.eventStore.filter(event => event.type === "INTERCEPTION").length;
    const recoveries = result.eventStore.filter(event => event.type === "BALL_RECOVERY").length;
    const duels = result.eventStore.filter(event => event.type === "DUEL").length;
    expect(result.analytics.teams.home.interceptions + result.analytics.teams.away.interceptions).toBe(interceptions);
    expect(result.analytics.teams.home.recoveries + result.analytics.teams.away.recoveries).toBe(recoveries);
    // Each causal duel has exactly two participants, one on each team.
    expect(result.analytics.teams.home.duels + result.analytics.teams.away.duels).toBe(duels * 2);
  }, 120_000);

  it("changes observability profiles without changing the sporting result", () => {
    const base = { ...buildSimulationConfig(81), tickDeltaSeconds: 0.2, maxDurationSeconds: 20 };
    const evaluation = new MatchEngine().simulate({
      ...base, instrumentation: { profile: "EVALUATION" },
    });
    const benchmark = new MatchEngine().simulate({
      ...base, instrumentation: { profile: "BENCHMARK" },
    });
    const { tactical: _evaluationTactical, ...evaluationMetrics } = evaluation.metrics;
    const { tactical: _benchmarkTactical, ...benchmarkMetrics } = benchmark.metrics;

    expect({
      score: [benchmark.homeScore, benchmark.awayScore],
      shots: [benchmark.homeShots, benchmark.awayShots],
      metrics: benchmarkMetrics,
    }).toEqual({
      score: [evaluation.homeScore, evaluation.awayScore],
      shots: [evaluation.homeShots, evaluation.awayShots],
      metrics: evaluationMetrics,
    });
    expect(benchmark.manifest.configurationHash).toBe(evaluation.manifest.configurationHash);
    expect(benchmark.resultHash).toBe(evaluation.resultHash);
    expect(benchmark.manifest.instrumentationHash).not.toBe(evaluation.manifest.instrumentationHash);
    expect(evaluation.eventStore.length).toBeGreaterThan(0);
    expect(evaluation.timeline.length).toBeGreaterThan(0);
    expect(Object.keys(evaluation.analytics.players).length).toBeGreaterThan(0);
    expect(benchmark.events).toEqual([]);
    expect(benchmark.eventStore).toEqual([]);
    expect(benchmark.timeline).toEqual([]);
    expect(benchmark.goalReplays).toEqual([]);
    expect(benchmark.analytics.players).toEqual({});
  });

  it("reproduces only when config and environment manifest match", () => {
    const config = { ...buildSimulationConfig(91), tickDeltaSeconds: 0.2, maxDurationSeconds: 5 };
    const engine = new MatchEngine();
    const original = engine.simulate(config);
    expect(engine.reproduce(config, original.manifest, original.resultHash)).toEqual(original);
    expect(() => engine.reproduce({ ...config, seed: 92 }, original.manifest)).toThrow(
      "Execution manifest mismatch",
    );
    expect(() => engine.reproduce(config, original.manifest, "0".repeat(64))).toThrow(
      "Reproduced result hash mismatch",
    );
  });
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

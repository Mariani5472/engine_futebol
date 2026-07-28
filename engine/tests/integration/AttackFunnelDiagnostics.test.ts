import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { AttackFunnelCollector } from "../../src/application/match/diagnostics/AttackFunnelCollector";
import { ShotFunnelDiagnostics } from "../../src/application/match/diagnostics/ShotFunnelDiagnostics";
import { buildSimulationConfig, buildMinimalMatchState } from "../helpers/builders";
import { Vector2 } from "../../src/core/geometry/Vector2";
import { BallState } from "../../src/core/movement/BallMatchState";

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

describe("AttackFunnel — PASS throughput + territory", () => {
  const engine = new MatchEngine();

  function runProbedMatch(seed: number, tick = 2, duration = 90 * 60) {
    const funnel = new AttackFunnelCollector();
    const config = {
      ...buildSimulationConfig(seed),
      seed,
      tickDeltaSeconds: tick,
      maxDurationSeconds: duration,
    };
    const result = engine.simulate(config, funnel);
    const report = funnel.finalize();
    return { result, report };
  }

  it("B: seeds 7/11/19 keep high ownership", () => {
    const seeds = [7, 11, 19];
    const samples = seeds.map((s) => runProbedMatch(s, 2, 90 * 60));

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        samples.map((s, i) => ({
          seed: seeds[i],
          ownership: +s.report.ownershipRatio.toFixed(3),
          tryStart: s.report.passTryStarts,
          executing: s.report.passReachedExecuting,
          ok: s.report.passResolvedSuccess,
          ratio: +s.report.passCompletionRatio.toFixed(3),
          completed: s.report.completedPassSamples,
          atk: +s.report.attackingThirdShareOfPossession.toFixed(3),
          zone: +s.report.shootingZoneShareOfPossession.toFixed(3),
          shots: s.result.metrics.totalShots,
        })),
        null,
        2,
      ),
    );

    expect(median(samples.map((s) => s.report.ownershipRatio))).toBeGreaterThan(0.5);
  }, 300_000);

  it("PASS throughput: many completed passes under tick=2s", () => {
    const { report } = runProbedMatch(11, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));

    // Before fix: n≈3 with ~1300 decisions. After: expect real throughput.
    expect(report.completedPassSamples).toBeGreaterThan(50);
    expect(report.passTryStarts).toBeGreaterThan(50);
    expect(report.passCompletionRatio).toBeGreaterThan(0.05);
    expect(report.avgLaneVsRealAbsError).toBeLessThan(8);
  }, 120_000);

  it("A/B aggregate seeds 1-3: median ownership + throughput + territory", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((seed) => runProbedMatch(seed, 2, 90 * 60));

    const ownerships = samples.map((s) => s.report.ownershipRatio);
    const avgOwnership = ownerships.reduce((a, b) => a + b, 0) / ownerships.length;
    const medianOwnership = median(ownerships);

    const avgCompleted =
      samples.reduce((s, x) => s + x.report.completedPassSamples, 0) / samples.length;
    const avgRatio =
      samples.reduce((s, x) => s + x.report.passCompletionRatio, 0) / samples.length;
    const avgAtk =
      samples.reduce((s, x) => s + x.report.attackingThirdShareOfPossession, 0) /
      samples.length;
    const avgZone =
      samples.reduce((s, x) => s + x.report.shootingZoneShareOfPossession, 0) /
      samples.length;
    const avgShots =
      samples.reduce((s, x) => s + x.result.metrics.totalShots, 0) / samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgOwnership: +avgOwnership.toFixed(3),
          medianOwnership: +medianOwnership.toFixed(3),
          avgCompleted: +avgCompleted.toFixed(1),
          avgPassCompletionRatio: +avgRatio.toFixed(3),
          avgAtk: +avgAtk.toFixed(4),
          avgZone: +avgZone.toFixed(4),
          avgShots: +avgShots.toFixed(2),
          targetAtk: 0.1,
          targetZone: 0.03,
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            ownership: +s.report.ownershipRatio.toFixed(3),
            tryStart: s.report.passTryStarts,
            ok: s.report.passResolvedSuccess,
            completed: s.report.completedPassSamples,
            ratio: +s.report.passCompletionRatio.toFixed(3),
            busy: +s.report.carrierBusyShareOfPossession.toFixed(3),
            atk: +s.report.attackingThirdShareOfPossession.toFixed(4),
            zone: +s.report.shootingZoneShareOfPossession.toFixed(4),
            shots: s.result.metrics.totalShots,
            goals: s.result.metrics.totalGoals,
          })),
        },
        null,
        2,
      ),
    );

    expect(medianOwnership).toBeGreaterThan(0.5);
    expect(avgOwnership).toBeGreaterThan(0.5);
    expect(avgCompleted).toBeGreaterThan(50);
    expect(avgRatio).toBeGreaterThan(0.05);
    expect(avgShots).toBeGreaterThanOrEqual(1);
  }, 300_000);

  it("C readiness: isolated box shot still executes", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    carrier.position = new Vector2(96, 34);
    carrier.hasBall = true;
    carrier.facingDirection = new Vector2(1, 0);
    carrier.balance = 100;
    carrier.stability = 100;
    carrier.bodyState = "STANDING";
    match.ball.owner = carrier;
    match.ball.position = carrier.position;
    match.ball.state = BallState.CONTROLLED;
    match.away.players[0].position = new Vector2(40, 10);

    const probe = new ShotFunnelDiagnostics().probe(match, carrier, {
      deltaTime: 0.25,
      maxAdvanceSteps: 60,
    });

    // eslint-disable-next-line no-console
    console.log(ShotFunnelDiagnostics.format(probe));

    expect(probe.selected.isShot).toBe(true);
    expect(probe.execution.shotEvents).toBeGreaterThanOrEqual(1);
  });
});

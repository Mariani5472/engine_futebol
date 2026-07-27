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

describe("AttackFunnel — effective progression + ownership median", () => {
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
          realDx: +s.report.avgPassRealForwardGain.toFixed(2),
          laneFP: +s.report.avgSelectedPassForwardProgress.toFixed(2),
          absErr: +s.report.avgLaneVsRealAbsError.toFixed(2),
          effective8m: +s.report.passEffectiveProgressiveRate.toFixed(3),
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

  it("A: lane FP approx real Dx after live-position fix", () => {
    const { report } = runProbedMatch(11, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));

    expect(report.completedPassSamples).toBeGreaterThan(20);
    expect(report.avgLaneVsRealAbsError).toBeLessThan(8);
    expect(report.avgPassRealForwardGain).toBeGreaterThan(-5);
  }, 120_000);

  it("A/B aggregate seeds 1-3: median ownership + progression stats", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((seed) => runProbedMatch(seed, 2, 90 * 60));

    const ownerships = samples.map((s) => s.report.ownershipRatio);
    const avgOwnership = ownerships.reduce((a, b) => a + b, 0) / ownerships.length;
    const medianOwnership = median(ownerships);
    const minOwnership = Math.min(...ownerships);

    const avgAtk =
      samples.reduce((s, x) => s + x.report.attackingThirdShareOfPossession, 0) /
      samples.length;
    const avgZone =
      samples.reduce((s, x) => s + x.report.shootingZoneShareOfPossession, 0) /
      samples.length;
    const avgReal =
      samples.reduce((s, x) => s + x.report.avgPassRealForwardGain, 0) / samples.length;
    const avgErr =
      samples.reduce((s, x) => s + x.report.avgLaneVsRealAbsError, 0) / samples.length;
    const avgEff =
      samples.reduce((s, x) => s + x.report.passEffectiveProgressiveRate, 0) /
      samples.length;
    const avgShots =
      samples.reduce((s, x) => s + x.result.metrics.totalShots, 0) / samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgOwnership: +avgOwnership.toFixed(3),
          medianOwnership: +medianOwnership.toFixed(3),
          minOwnership: +minOwnership.toFixed(3),
          avgAtk: +avgAtk.toFixed(4),
          avgZone: +avgZone.toFixed(4),
          avgRealDx: +avgReal.toFixed(2),
          avgLaneVsRealErr: +avgErr.toFixed(2),
          avgEffective8m: +avgEff.toFixed(3),
          avgShots: +avgShots.toFixed(2),
          targetAtk: 0.1,
          targetZone: 0.03,
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            ownership: +s.report.ownershipRatio.toFixed(3),
            atk: +s.report.attackingThirdShareOfPossession.toFixed(4),
            zone: +s.report.shootingZoneShareOfPossession.toFixed(4),
            realDx: +s.report.avgPassRealForwardGain.toFixed(2),
            laneFP: +s.report.avgSelectedPassForwardProgress.toFixed(2),
            err: +s.report.avgLaneVsRealAbsError.toFixed(2),
            effective: +s.report.passEffectiveProgressiveRate.toFixed(3),
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
    expect(avgErr).toBeLessThan(10);
    expect(avgShots).toBeGreaterThanOrEqual(1);

    if (minOwnership < 0.25) {
      // eslint-disable-next-line no-console
      console.warn(
        `ownership outlier min=${minOwnership.toFixed(3)} — investigate FREE-ball reclaim`,
      );
    }
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

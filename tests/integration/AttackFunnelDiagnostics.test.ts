import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { AttackFunnelCollector } from "../../src/application/match/diagnostics/AttackFunnelCollector";
import { ShotFunnelDiagnostics } from "../../src/application/match/diagnostics/ShotFunnelDiagnostics";
import { buildSimulationConfig, buildMinimalMatchState } from "../helpers/builders";
import { Vector2 } from "../../src/core/geometry/Vector2";
import { BallState } from "../../src/core/movement/BallMatchState";

describe("AttackFunnel — priorities A progression / B ownership / C conversion readiness", () => {
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

  it("B: min ownership across seeds 7/11/19 stays usable", () => {
    const seeds = [7, 11, 19];
    const samples = seeds.map((s) => runProbedMatch(s, 2, 90 * 60));

    const ratios = samples.map((s) => s.report.ownershipRatio);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        samples.map((s, i) => ({
          seed: seeds[i],
          ownership: +s.report.ownershipRatio.toFixed(3),
          passFP: +s.report.avgSelectedPassForwardProgress.toFixed(2),
          progressive: s.report.progressivePassCount,
          lateral: s.report.lateralPassCount,
          back: s.report.backwardPassCount,
          supportAhead: +s.report.supportAheadShareOfPossession.toFixed(3),
          atk: +s.report.attackingThirdShareOfPossession.toFixed(3),
          zone: +s.report.shootingZoneShareOfPossession.toFixed(3),
          shots: s.result.metrics.totalShots,
        })),
        null,
        2,
      ),
    );

    const minOwnership = Math.min(...ratios);
    // Target: >30%. Soft floor 25% while progression work continues.
    expect(minOwnership).toBeGreaterThan(0.25);
  }, 300_000);

  it("A: reports pass forwardProgress and prefers progression over pure lateral spam", () => {
    const { report } = runProbedMatch(11, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));

    expect(report.passDecisions).toBeGreaterThan(20);
    // Mean selected pass should not be strongly backward.
    expect(report.avgSelectedPassForwardProgress).toBeGreaterThan(-2);
    // Progressive count should not be zero if support exists.
    // (May still be low until tactical support is fully effective.)
    expect(
      report.progressivePassCount + report.lateralPassCount + report.backwardPassCount,
    ).toBeGreaterThan(0);
  }, 120_000);

  it("A/B aggregate seeds 1–3: ownership, progression stats, zone trend", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((seed) => runProbedMatch(seed, 2, 90 * 60));

    const avgOwnership =
      samples.reduce((s, x) => s + x.report.ownershipRatio, 0) / samples.length;
    const minOwnership = Math.min(...samples.map((s) => s.report.ownershipRatio));
    const avgAtk =
      samples.reduce((s, x) => s + x.report.attackingThirdShareOfPossession, 0) /
      samples.length;
    const avgZone =
      samples.reduce((s, x) => s + x.report.shootingZoneShareOfPossession, 0) /
      samples.length;
    const avgPassFP =
      samples.reduce((s, x) => s + x.report.avgSelectedPassForwardProgress, 0) /
      samples.length;
    const avgSupport =
      samples.reduce((s, x) => s + x.report.supportAheadShareOfPossession, 0) /
      samples.length;
    const avgShots =
      samples.reduce((s, x) => s + x.result.metrics.totalShots, 0) / samples.length;
    const avgOnTarget =
      samples.reduce((s, x) => s + x.result.metrics.totalShotsOnTarget, 0) /
      samples.length;
    const avgGoals =
      samples.reduce((s, x) => s + x.result.metrics.totalGoals, 0) / samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgOwnership: +avgOwnership.toFixed(3),
          minOwnership: +minOwnership.toFixed(3),
          avgAtk: +avgAtk.toFixed(4),
          avgZone: +avgZone.toFixed(4),
          avgPassFP: +avgPassFP.toFixed(2),
          avgSupport: +avgSupport.toFixed(3),
          avgShots: +avgShots.toFixed(2),
          avgOnTarget: +avgOnTarget.toFixed(2),
          avgGoals: +avgGoals.toFixed(2),
          // Intermediate targets (A): atk>10% zone>3% — logged for planning
          targetAtk: 0.1,
          targetZone: 0.03,
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            ownership: +s.report.ownershipRatio.toFixed(3),
            atk: +s.report.attackingThirdShareOfPossession.toFixed(4),
            zone: +s.report.shootingZoneShareOfPossession.toFixed(4),
            passFP: +s.report.avgSelectedPassForwardProgress.toFixed(2),
            progressive: s.report.progressivePassCount,
            lateral: s.report.lateralPassCount,
            back: s.report.backwardPassCount,
            support: +s.report.supportAheadShareOfPossession.toFixed(3),
            shots: s.result.metrics.totalShots,
            onTarget: s.result.metrics.totalShotsOnTarget,
            goals: s.result.metrics.totalGoals,
          })),
        },
        null,
        2,
      ),
    );

    expect(avgOwnership).toBeGreaterThan(0.3);
    expect(minOwnership).toBeGreaterThan(0.25);
    expect(avgPassFP).toBeGreaterThan(-3);
    // C stays observational until volume ≥10; soft floor on shots only.
    expect(avgShots).toBeGreaterThanOrEqual(1);
  }, 300_000);

  it("C readiness: isolated box shot still executes (conversion tuned later)", () => {
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

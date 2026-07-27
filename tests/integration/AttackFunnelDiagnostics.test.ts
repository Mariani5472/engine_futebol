import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { AttackFunnelCollector } from "../../src/application/match/diagnostics/AttackFunnelCollector";
import { ShotFunnelDiagnostics } from "../../src/application/match/diagnostics/ShotFunnelDiagnostics";
import { buildSimulationConfig, buildMinimalMatchState } from "../helpers/builders";
import { Vector2 } from "../../src/core/geometry/Vector2";
import { BallState } from "../../src/core/movement/BallMatchState";

/**
 * Post-fix probes:
 *  - possession must stay assigned most of the match
 *  - DRIBBLE must not be ~99% of on-ball decisions
 *  - box shot funnel still works in isolation
 *  - zone time / shots should trend up vs the pre-fix baseline (~0.02% zone, ~1 shot)
 */
describe("AttackFunnelDiagnostics — post possession/dribble fixes", () => {
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

  it("keeps the ball owned for the majority of ticks", () => {
    // Aggregate across seeds so a single unlucky kick-off does not flake.
    const seeds = [7, 11, 19];
    const samples = seeds.map((s) => runProbedMatch(s, 2, 90 * 60));

    for (const { report } of samples) {
      // eslint-disable-next-line no-console
      console.log(AttackFunnelCollector.format(report));
      const ownershipRatio = report.possessionTicks / Math.max(1, report.ticks);
      expect(ownershipRatio).toBeGreaterThan(0.5);
    }
  }, 300_000);

  it("DRIBBLE is no longer ~99% of possession decisions", () => {
    const { report } = runProbedMatch(11, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));

    expect(report.totalPossessionDecisions).toBeGreaterThan(50);

    const dribbleShare =
      report.dribbleDecisions / Math.max(1, report.totalPossessionDecisions);
    const passShare =
      report.passDecisions / Math.max(1, report.totalPossessionDecisions);

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        dribbleShare: +dribbleShare.toFixed(3),
        passShare: +passShare.toFixed(3),
        hold: report.holdDecisions,
        shot: report.shotDecisions,
        pass: report.passDecisions,
        dribble: report.dribbleDecisions,
      }),
    );

    // Pre-fix baseline was ~0.99 dribble. Post-fix must be clearly lower.
    expect(dribbleShare).toBeLessThan(0.75);
    // Passes should exist as a real alternative.
    expect(report.passDecisions).toBeGreaterThan(10);
  }, 120_000);

  it("aggregate 3 seeds: report zone/shots/dribble for calibration feedback", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((seed) => runProbedMatch(seed, 2, 90 * 60));

    const avgZoneShare =
      samples.reduce((s, x) => s + x.report.shootingZoneShareOfPossession, 0) /
      samples.length;
    const avgShots =
      samples.reduce((s, x) => s + x.result.metrics.totalShots, 0) /
      samples.length;
    const avgShotDecisions =
      samples.reduce((s, x) => s + x.report.shotDecisions, 0) / samples.length;
    const avgAtkShare =
      samples.reduce(
        (s, x) => s + x.report.attackingThirdShareOfPossession,
        0,
      ) / samples.length;
    const avgDribbleShare =
      samples.reduce((s, x) => {
        const total = Math.max(1, x.report.totalPossessionDecisions);
        return s + x.report.dribbleDecisions / total;
      }, 0) / samples.length;
    const avgOwnership =
      samples.reduce(
        (s, x) => s + x.report.possessionTicks / Math.max(1, x.report.ticks),
        0,
      ) / samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgOwnership: +avgOwnership.toFixed(3),
          avgZoneShare: +avgZoneShare.toFixed(4),
          avgAtkShare: +avgAtkShare.toFixed(4),
          avgShots: +avgShots.toFixed(2),
          avgShotDecisions: +avgShotDecisions.toFixed(2),
          avgDribbleShare: +avgDribbleShare.toFixed(3),
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            ownership: +(s.report.possessionTicks / Math.max(1, s.report.ticks)).toFixed(3),
            zoneShare: +s.report.shootingZoneShareOfPossession.toFixed(4),
            atkShare: +s.report.attackingThirdShareOfPossession.toFixed(4),
            shots: s.result.metrics.totalShots,
            shotDecisions: s.report.shotDecisions,
            pass: s.report.passDecisions,
            dribble: s.report.dribbleDecisions,
            hold: s.report.holdDecisions,
            minGoalDist: +s.report.minGoalDistanceObserved.toFixed(1),
            avgGoalDist: +s.report.avgGoalDistanceWhenInPossession.toFixed(1),
          })),
        },
        null,
        2,
      ),
    );

    expect(avgOwnership).toBeGreaterThan(0.5);
    expect(avgDribbleShare).toBeLessThan(0.8);
    // Soft floor: after fixes we expect at least as many shots as before (≥1 on average),
    // and not a collapse. Hard ceiling still reflects "not yet Brasileirão".
    expect(avgShots).toBeGreaterThanOrEqual(0.5);
    expect(avgShots).toBeLessThan(40);
  }, 300_000);

  it("contrast: isolated box carrier still selects and executes SHOT", () => {
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

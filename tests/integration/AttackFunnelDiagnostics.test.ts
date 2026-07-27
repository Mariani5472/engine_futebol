import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { AttackFunnelCollector } from "../../src/application/match/diagnostics/AttackFunnelCollector";
import { ShotFunnelDiagnostics } from "../../src/application/match/diagnostics/ShotFunnelDiagnostics";
import { buildSimulationConfig, buildMinimalMatchState } from "../helpers/builders";
import { Vector2 } from "../../src/core/geometry/Vector2";
import { BallState } from "../../src/core/movement/BallMatchState";

describe("AttackFunnelDiagnostics — post pass-completion ownership fix", () => {
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

  it("keeps the ball owned for a substantial share of ticks", () => {
    const seeds = [7, 11, 19];
    const samples = seeds.map((s) => runProbedMatch(s, 2, 90 * 60));

    for (const { report } of samples) {
      // eslint-disable-next-line no-console
      console.log(AttackFunnelCollector.format(report));
      const ownershipRatio = report.possessionTicks / Math.max(1, report.ticks);
      // Pre-pass-fix: 0.3–6%. Target after delivery: majority of match.
      expect(ownershipRatio).toBeGreaterThan(0.35);
    }
  }, 300_000);

  it("PASS dominates over DRIBBLE without collapsing total decisions", () => {
    const { report } = runProbedMatch(11, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));

    expect(report.totalPossessionDecisions).toBeGreaterThan(40);

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
        ownership: +(report.possessionTicks / report.ticks).toFixed(3),
      }),
    );

    expect(dribbleShare).toBeLessThan(0.55);
    expect(report.passDecisions).toBeGreaterThan(report.dribbleDecisions);
  }, 120_000);

  it("aggregate 3 seeds: ownership, dribble share, zone, shots", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((seed) => runProbedMatch(seed, 2, 90 * 60));

    const avgZoneShare =
      samples.reduce((s, x) => s + x.report.shootingZoneShareOfPossession, 0) /
      samples.length;
    const avgShots =
      samples.reduce((s, x) => s + x.result.metrics.totalShots, 0) /
      samples.length;
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
    const avgPass =
      samples.reduce((s, x) => s + x.report.passDecisions, 0) / samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgOwnership: +avgOwnership.toFixed(3),
          avgZoneShare: +avgZoneShare.toFixed(4),
          avgAtkShare: +avgAtkShare.toFixed(4),
          avgShots: +avgShots.toFixed(2),
          avgDribbleShare: +avgDribbleShare.toFixed(3),
          avgPass: +avgPass.toFixed(1),
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

    expect(avgOwnership).toBeGreaterThan(0.35);
    expect(avgDribbleShare).toBeLessThan(0.55);
    expect(avgShots).toBeGreaterThanOrEqual(0.5);
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

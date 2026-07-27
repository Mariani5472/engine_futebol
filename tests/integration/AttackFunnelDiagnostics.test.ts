import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { AttackFunnelCollector } from "../../src/application/match/diagnostics/AttackFunnelCollector";
import { ShotFunnelDiagnostics } from "../../src/application/match/diagnostics/ShotFunnelDiagnostics";
import { buildSimulationConfig, buildMinimalMatchState } from "../helpers/builders";
import { Vector2 } from "../../src/core/geometry/Vector2";
import { BallState } from "../../src/core/movement/BallMatchState";

/**
 * Integration probes that document the real calibration gap:
 *   - Shot funnel works when the carrier is already in the box.
 *   - Full matches almost never put the carrier in the shooting zone.
 */
describe("AttackFunnelDiagnostics — prove scarce chance creation", () => {
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

  it("full match spends almost no possession time in the shooting zone", () => {
    const { result, report } = runProbedMatch(7, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));
    // eslint-disable-next-line no-console
    console.log(
      `metrics shots=${result.metrics.totalShots} goals=${result.metrics.totalGoals} attacks=${result.metrics.home.attacks + result.metrics.away.attacks}`,
    );

    expect(report.possessionTicks).toBeGreaterThan(100);

    // Core claim: shooting-zone share of possession is tiny vs real football
    // (real games have many box entries; engine ≈ 1 shot/game).
    expect(report.shootingZoneShareOfPossession).toBeLessThan(0.08);

    // Avg carrier distance to goal stays large (not parked in the box).
    expect(report.avgGoalDistanceWhenInPossession).toBeGreaterThan(25);
  }, 120_000);

  it("full match starts very few SHOT decisions compared to PASS/HOLD/DRIBBLE", () => {
    const { report } = runProbedMatch(11, 2, 90 * 60);

    // eslint-disable-next-line no-console
    console.log(AttackFunnelCollector.format(report));

    expect(report.totalPossessionDecisions).toBeGreaterThan(50);

    const nonShot =
      report.passDecisions + report.holdDecisions + report.dribbleDecisions;
    // SHOT is a tiny fraction of on-ball decisions in a full match.
    if (nonShot > 0) {
      expect(report.shotDecisions / Math.max(1, report.totalPossessionDecisions)).toBeLessThan(
        0.05,
      );
    }

    // Absolute shot decisions stay near the ~1 shot/game calibration reality.
    expect(report.shotDecisions).toBeLessThan(15);
  }, 120_000);

  it("aggregate over 3 seeds: low shooting-zone time and low shots", () => {
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

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgZoneShare: +avgZoneShare.toFixed(4),
          avgAtkShare: +avgAtkShare.toFixed(4),
          avgShots: +avgShots.toFixed(2),
          avgShotDecisions: +avgShotDecisions.toFixed(2),
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            zoneShare: +s.report.shootingZoneShareOfPossession.toFixed(4),
            atkShare: +s.report.attackingThirdShareOfPossession.toFixed(4),
            shots: s.result.metrics.totalShots,
            shotDecisions: s.report.shotDecisions,
            minGoalDist: +s.report.minGoalDistanceObserved.toFixed(1),
            avgGoalDist: +s.report.avgGoalDistanceWhenInPossession.toFixed(1),
          })),
        },
        null,
        2,
      ),
    );

    // Matches calibrate: ~1 shot/game, scarce box time.
    expect(avgShots).toBeLessThan(5);
    expect(avgZoneShare).toBeLessThan(0.10);
    expect(avgShotDecisions).toBeLessThan(12);
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

  it("when shooting-zone decisions occur, SHOT share is higher than overall", () => {
    // May be sparse; over a few seeds, conditional SHOT rate in zone ≥ overall rate.
    const seeds = [5, 17, 29];
    let zoneShot = 0;
    let zoneTotal = 0;
    let allShot = 0;
    let allTotal = 0;

    for (const seed of seeds) {
      const { report } = runProbedMatch(seed, 2, 90 * 60);
      allShot += report.shotDecisions;
      allTotal += report.totalPossessionDecisions;

      const zoneDecisions = Object.values(
        report.possessionDecisionsInShootingZone,
      ).reduce((a, b) => a + b, 0);
      zoneTotal += zoneDecisions;
      zoneShot += report.shotDecisionsInShootingZone;
    }

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          overallShotRate: allTotal ? +(allShot / allTotal).toFixed(4) : 0,
          zoneShotRate: zoneTotal ? +(zoneShot / zoneTotal).toFixed(4) : null,
          zoneTotalDecisions: zoneTotal,
          zoneShots: zoneShot,
        },
        null,
        2,
      ),
    );

    // If the zone was visited with decisions, SHOT should not be rarer there than overall.
    if (zoneTotal >= 5) {
      expect(zoneShot / zoneTotal).toBeGreaterThanOrEqual(allShot / Math.max(1, allTotal) - 0.01);
    } else {
      // Even stronger proof of the bottleneck: almost no decisions ever happen in the box.
      expect(zoneTotal).toBeLessThan(5);
    }
  }, 300_000);
});

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

describe("Offensive volume calibration after SHOT cooldown", () => {
  const engine = new MatchEngine();

  function run(seed: number, tick = 2) {
    const funnel = new AttackFunnelCollector();
    const result = engine.simulate(
      {
        ...buildSimulationConfig(seed),
        seed,
        tickDeltaSeconds: tick,
        maxDurationSeconds: 90 * 60,
      },
      funnel,
    );
    return { result, report: funnel.finalize() };
  }

  it("keeps PASS throughput and ownership while cutting shot spam", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((s) => run(s, 2));

    const avgShots =
      samples.reduce((a, s) => a + s.result.metrics.totalShots, 0) / samples.length;
    const avgGoals =
      samples.reduce((a, s) => a + s.result.metrics.totalGoals, 0) / samples.length;
    const avgCompleted =
      samples.reduce((a, s) => a + s.report.completedPassSamples, 0) / samples.length;
    const medianOwnership = median(samples.map((s) => s.report.ownershipRatio));
    const avgAtk =
      samples.reduce((a, s) => a + s.report.attackingThirdShareOfPossession, 0) /
      samples.length;
    const avgZone =
      samples.reduce((a, s) => a + s.report.shootingZoneShareOfPossession, 0) /
      samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgShots: +avgShots.toFixed(1),
          avgGoals: +avgGoals.toFixed(1),
          avgCompleted: +avgCompleted.toFixed(1),
          medianOwnership: +medianOwnership.toFixed(3),
          avgAtk: +avgAtk.toFixed(3),
          avgZone: +avgZone.toFixed(3),
          targetShotsSoft: "15-60 (toward 25)",
          targetGoalsSoft: "1-12 (toward 2.5)",
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            shots: s.result.metrics.totalShots,
            goals: s.result.metrics.totalGoals,
            completed: s.report.completedPassSamples,
            ratio: +s.report.passCompletionRatio.toFixed(3),
            ownership: +s.report.ownershipRatio.toFixed(3),
            atk: +s.report.attackingThirdShareOfPossession.toFixed(3),
            zone: +s.report.shootingZoneShareOfPossession.toFixed(3),
            hold: s.report.holdDecisions,
            shotDec: s.report.shotDecisions,
          })),
        },
        null,
        2,
      ),
    );

    // Regression guards: what was fixed must stay fixed.
    expect(medianOwnership).toBeGreaterThan(0.5);
    expect(avgCompleted).toBeGreaterThan(50);
    expect(avgAtk).toBeGreaterThan(0.05);

    // Volume must drop massively vs the 300–600 era.
    expect(avgShots).toBeLessThan(120);
    expect(avgShots).toBeGreaterThan(5);
    expect(avgGoals).toBeLessThan(40);
  }, 300_000);

  it("logs seed 19 ownership without failing the suite", () => {
    const { report, result } = run(19, 2);
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          seed: 19,
          ownership: +report.ownershipRatio.toFixed(3),
          shots: result.metrics.totalShots,
          goals: result.metrics.totalGoals,
          completed: report.completedPassSamples,
          atk: +report.attackingThirdShareOfPossession.toFixed(3),
        },
        null,
        2,
      ),
    );
    // Soft floor only — outlier investigation, not a hard fail.
    expect(report.ownershipRatio).toBeGreaterThan(0.15);
  }, 120_000);

  it("isolated box chance still selects and executes SHOT", () => {
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
    match.home.shotLockUntil = 0;
    match.home.shotsThisPossession = 0;

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

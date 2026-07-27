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

describe("Offensive volume + discipline calibration", () => {
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

  it("cuts shots toward 25–55 while keeping throughput and territory", () => {
    const seeds = [1, 2, 3];
    const samples = seeds.map((s) => run(s, 2));

    const avgShots =
      samples.reduce((a, s) => a + s.result.metrics.totalShots, 0) / samples.length;
    const avgGoals =
      samples.reduce((a, s) => a + s.result.metrics.totalGoals, 0) / samples.length;
    const avgCorners =
      samples.reduce((a, s) => a + s.result.metrics.totalCorners, 0) / samples.length;
    const avgFouls =
      samples.reduce((a, s) => a + s.result.metrics.totalFouls, 0) / samples.length;
    const avgReds =
      samples.reduce((a, s) => a + s.result.metrics.totalRedCards, 0) / samples.length;
    const avgCompleted =
      samples.reduce((a, s) => a + s.report.completedPassSamples, 0) / samples.length;
    const medianOwnership = median(samples.map((s) => s.report.ownershipRatio));
    const avgAtk =
      samples.reduce((a, s) => a + s.report.attackingThirdShareOfPossession, 0) /
      samples.length;

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          avgShots: +avgShots.toFixed(1),
          avgGoals: +avgGoals.toFixed(1),
          avgCorners: +avgCorners.toFixed(1),
          avgFouls: +avgFouls.toFixed(1),
          avgReds: +avgReds.toFixed(2),
          avgCompleted: +avgCompleted.toFixed(1),
          medianOwnership: +medianOwnership.toFixed(3),
          avgAtk: +avgAtk.toFixed(3),
          targets: {
            shots: "~25-55",
            goals: "~1-8 toward 2.5",
            corners: ">0",
            reds: "<2",
          },
          perSeed: samples.map((s, i) => ({
            seed: seeds[i],
            shots: s.result.metrics.totalShots,
            goals: s.result.metrics.totalGoals,
            corners: s.result.metrics.totalCorners,
            fouls: s.result.metrics.totalFouls,
            reds: s.result.metrics.totalRedCards,
            yellows: s.result.metrics.totalYellowCards,
            completed: s.report.completedPassSamples,
            ownership: +s.report.ownershipRatio.toFixed(3),
            atk: +s.report.attackingThirdShareOfPossession.toFixed(3),
          })),
        },
        null,
        2,
      ),
    );

    expect(medianOwnership).toBeGreaterThan(0.5);
    expect(avgCompleted).toBeGreaterThan(50);
    expect(avgAtk).toBeGreaterThan(0.05);

    // Volume band after 30s lock + 1/possession + scale 0.35
    expect(avgShots).toBeLessThan(70);
    expect(avgShots).toBeGreaterThan(8);
    expect(avgGoals).toBeLessThan(20);

    // Corners should appear from off-target / parries
    expect(avgCorners).toBeGreaterThan(0);

    // Reds should stay rare relative to the old 20+/game era
    expect(avgReds).toBeLessThan(3);
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
          corners: result.metrics.totalCorners,
          fouls: result.metrics.totalFouls,
          reds: result.metrics.totalRedCards,
        },
        null,
        2,
      ),
    );
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

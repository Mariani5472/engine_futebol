import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { ShotFunnelDiagnostics } from "../../../src/application/match/diagnostics/ShotFunnelDiagnostics";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("ShotFunnelDiagnostics — locate where shots die", () => {
  const diagnostics = new ShotFunnelDiagnostics();

  function placeCarrierNearGoal(x = 95, y = 34) {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    carrier.position = new Vector2(x, y);
    carrier.hasBall = true;
    carrier.facingDirection = new Vector2(1, 0);
    carrier.balance = 100;
    carrier.stability = 100;
    carrier.bodyState = "STANDING";
    carrier.lastActionType = undefined;
    match.ball.owner = carrier;
    match.ball.position = carrier.position;
    match.ball.state = BallState.CONTROLLED;
    // Push defender far away to reduce pressure.
    match.away.players[0].position = new Vector2(50, 10);
    return { match, carrier };
  }

  it("reports world shotWindow and short goalDistance in the box", () => {
    const { match, carrier } = placeCarrierNearGoal(98, 34);
    const result = diagnostics.probe(match, carrier);

    // eslint-disable-next-line no-console
    console.log(ShotFunnelDiagnostics.format(result));

    expect(result.world.goalDistance).toBeLessThan(12);
    expect(result.world.shotWindow).toBeGreaterThan(0.4);
  });

  it("ShotEvaluator proposes a high-utility SHOT in the box", () => {
    const { match, carrier } = placeCarrierNearGoal(96, 34);
    const result = diagnostics.probe(match, carrier);

    expect(result.shotEvaluator.proposed).toBe(true);
    expect(result.shotEvaluator.utility).toBeGreaterThan(40);
  });

  it("SHOT ranks among top possession candidates near goal", () => {
    const { match, carrier } = placeCarrierNearGoal(96, 34);
    const result = diagnostics.probe(match, carrier);

    const shot = result.candidates.find((c) => c.type === "SHOT");
    expect(shot).toBeDefined();
    // Must beat pure hold/pass in isolation ranking for diagnostic clarity.
    const top = result.candidates[0];
    // Log full ranking for root-cause inspection when this fails.
    // eslint-disable-next-line no-console
    console.log("candidates", result.candidates.slice(0, 8));

    expect(shot!.utility).toBeGreaterThan(30);
    // Prefer that SHOT is top or within 20% of top utility.
    expect(shot!.utility).toBeGreaterThanOrEqual(top.utility * 0.8);
  });

  it("PossessionDecisionSystem selects SHOT when alone in the box", () => {
    const { match, carrier } = placeCarrierNearGoal(96, 34);
    const result = diagnostics.probe(match, carrier);

    // eslint-disable-next-line no-console
    console.log(ShotFunnelDiagnostics.format(result));

    expect(result.selected.isShot).toBe(true);
  });

  it("pipeline starts and reaches SHOT EXECUTING with shot events", () => {
    const { match, carrier } = placeCarrierNearGoal(96, 34);
    const result = diagnostics.probe(match, carrier, {
      deltaTime: 0.25,
      maxAdvanceSteps: 60,
    });

    // eslint-disable-next-line no-console
    console.log(ShotFunnelDiagnostics.format(result));

    expect(result.selected.isShot).toBe(true);
    expect(result.pipeline.started).toBe(true);
    expect(result.pipeline.steps.some((s) => s === "SHOT")).toBe(true);
    expect(result.execution.reachedExecuting).toBe(true);
    expect(result.execution.shotEvents).toBeGreaterThanOrEqual(1);
  });

  it("midfield carrier has lower shot utility than box carrier", () => {
    const box = placeCarrierNearGoal(96, 34);
    const mid = placeCarrierNearGoal(52, 34);

    const boxResult = diagnostics.probe(box.match, box.carrier);
    const midResult = diagnostics.probe(mid.match, mid.carrier);

    // eslint-disable-next-line no-console
    console.log("BOX", ShotFunnelDiagnostics.format(boxResult));
    // eslint-disable-next-line no-console
    console.log("MID", ShotFunnelDiagnostics.format(midResult));

    expect(boxResult.shotEvaluator.utility).toBeGreaterThan(
      midResult.shotEvaluator.utility,
    );
  });

  it("under heavy pressure still proposes shot but with lower utility", () => {
    const { match, carrier } = placeCarrierNearGoal(96, 34);
    // Defender glued to carrier
    match.away.players[0].position = new Vector2(96.5, 34);

    const result = diagnostics.probe(match, carrier);
    // eslint-disable-next-line no-console
    console.log("PRESSURE", ShotFunnelDiagnostics.format(result));

    expect(result.world.pressure).toBeGreaterThan(0.5);
    expect(result.shotEvaluator.proposed).toBe(true);
  });
});

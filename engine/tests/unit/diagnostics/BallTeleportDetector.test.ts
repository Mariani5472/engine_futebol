import { BallTeleportDetector } from "../../../src/application/match/diagnostics/BallTeleportDetector";
import { Vector2 } from "../../../src/core/geometry/Vector2";

describe("BallTeleportDetector", () => {
  const detector = new BallTeleportDetector();

  it("reports seed, second and player for an impossible displacement", () => {
    const violations = detector.inspectTick({
      seed: 47, matchSecond: 123.45, deltaTime: .05,
      before: new Vector2(20, 30), after: new Vector2(55, 42),
      beforeSpeed: 0, afterSpeed: 0, isRestart: false,
      acquisitions: [{
        type: "POSSESSION_CHANGED", matchSecond: 123.45, playerId: "home-8",
        distanceToBall: 37, ballSpeed: 0, reason: "PASS_RESOLUTION",
        previousAction: null, ballPosition: new Vector2(20, 30), playerPosition: new Vector2(55, 42),
      }],
    });

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ seed: 47, matchSecond: 123.45, playerId: "home-8", reason: "PASS_RESOLUTION" });
    expect(() => detector.assertNoTeleport(violations)).toThrow(/seed=47 second=123\.45 player=home-8/);
  });

  it("accepts displacement supported by velocity and timestep", () => {
    const violations = detector.inspectTick({
      seed: 1, matchSecond: 4, deltaTime: .05,
      before: new Vector2(20, 30), after: new Vector2(21, 30),
      beforeSpeed: 20, afterSpeed: 20, acquisitions: [], isRestart: false,
    });
    expect(violations).toHaveLength(0);
    expect(() => detector.assertNoTeleport(violations)).not.toThrow();
  });

  it("does not classify an explicit restart as a teleport", () => {
    expect(detector.inspectTick({
      seed: 1, matchSecond: 40, deltaTime: .05,
      before: new Vector2(105, 34), after: new Vector2(52.5, 34),
      beforeSpeed: 0, afterSpeed: 0, acquisitions: [], isRestart: true,
    })).toHaveLength(0);
  });
});

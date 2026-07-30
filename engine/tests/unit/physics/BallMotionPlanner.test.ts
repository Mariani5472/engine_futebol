import { BallMotionPlanner } from "../../../src/application/match/physics/BallMotionPlanner";
import { BallPhysicsSystem } from "../../../src/application/match/physics/BallPhysicsSystem";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState } from "../../helpers/builders";

function distanceFromSegmentLine(point: Vector2, origin: Vector2, target: Vector2): number {
  const line = target.subtract(origin);
  return Math.abs(line.cross(point.subtract(origin))) / line.magnitude();
}

describe("engine-owned ball motion", () => {
  const physics = new BallPhysicsSystem();

  it("keeps every ordinary ground pass on a straight horizontal path", () => {
    for (let sample = 0; sample < 20; sample++) {
      const state = buildMinimalMatchState();
      const origin = new Vector2(12, 8 + sample * 2);
      const target = new Vector2(72, 18 + sample);
      BallMotionPlanner.start(state.ball, { kind: "GROUND_PASS", origin, target, speed: 24 });
      while (state.ball.motion) {
        physics.update(state, .05);
        expect(distanceFromSegmentLine(state.ball.visualPosition, origin, target)).toBeLessThan(1e-8);
      }
      expect(state.ball.visualPosition.distanceTo(target)).toBeLessThan(1e-8);
    }
  });

  it("uses a direct horizontal path and a vertical arc for aerial passes", () => {
    const state = buildMinimalMatchState();
    const origin = new Vector2(10, 20);
    const target = new Vector2(70, 46);
    BallMotionPlanner.start(state.ball, { kind: "AERIAL_PASS", origin, target, speed: 26, peakHeight: 5 });
    physics.update(state, .6);

    expect(distanceFromSegmentLine(state.ball.visualPosition, origin, target)).toBeLessThan(1e-8);
    expect(state.ball.visualHeight).toBeGreaterThan(0);
  });

  it("curves only when the kick carries explicit effect", () => {
    const state = buildMinimalMatchState();
    const origin = new Vector2(10, 15);
    const target = new Vector2(75, 42);
    BallMotionPlanner.start(state.ball, {
      kind: "CROSS", origin, target, speed: 25, peakHeight: 4,
      curve: 3, hasExplicitEffect: true,
    });
    physics.update(state, .8);
    expect(state.ball.motion?.hasExplicitEffect).toBe(true);
    expect(distanceFromSegmentLine(state.ball.visualPosition, origin, target)).toBeGreaterThan(.5);

    BallMotionPlanner.start(state.ball, {
      kind: "GROUND_PASS", origin, target, speed: 25,
      curve: 8, hasExplicitEffect: false,
    });
    physics.update(state, .8);
    expect(distanceFromSegmentLine(state.ball.visualPosition, origin, target)).toBeLessThan(1e-8);
  });

  it("starts a deflection at the actual contact point", () => {
    const state = buildMinimalMatchState();
    const firstOrigin = new Vector2(10, 34);
    BallMotionPlanner.start(state.ball, { kind: "SHOT", origin: firstOrigin, target: new Vector2(100, 34), speed: 35 });
    physics.update(state, .5);
    const contact = state.ball.visualPosition;
    const deflectedTarget = contact.add(new Vector2(15, -9));
    BallMotionPlanner.start(state.ball, { kind: "DEFLECTION", origin: contact, target: deflectedTarget, speed: 18 });

    expect(state.ball.motion?.origin.distanceTo(contact)).toBe(0);
    expect(state.ball.visualPosition.distanceTo(contact)).toBe(0);
  });
});

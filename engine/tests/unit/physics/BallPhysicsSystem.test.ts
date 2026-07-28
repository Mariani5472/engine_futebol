import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallMatchState, BallState } from "../../../src/core/movement/BallMatchState";
import { BallPhysicsSystem } from "../../../src/application/match/physics/BallPhysicsSystem";
import { buildMinimalMatchState } from "../../helpers/builders";

function makeFreeBalll(vx: number, vy: number, height = 0): BallMatchState {
  return new BallMatchState(
    new Vector2(52, 34),
    new Vector2(vx, vy),
    null,
    BallState.FREE,
    height
  );
}

describe("BallPhysicsSystem", () => {
  const physics = new BallPhysicsSystem();

  describe("ground friction", () => {
    it("decelerates a rolling ball each tick", () => {
      const state = buildMinimalMatchState();
      // Put ball in free motion.
      (state.ball as any).owner = null;
      (state.ball as any).state = BallState.FREE;
      (state.ball as any).velocity = new Vector2(20, 0);

      const initialSpeed = state.ball.velocity.magnitude();
      physics.update(state, 0.5);
      const afterSpeed = state.ball.velocity.magnitude();

      expect(afterSpeed).toBeLessThan(initialSpeed);
    });

    it("eventually brings the ball to rest", () => {
      const state = buildMinimalMatchState();
      (state.ball as any).owner = null;
      (state.ball as any).state = BallState.FREE;
      (state.ball as any).velocity = new Vector2(5, 0);
      (state.ball as any).height = 0;

      for (let i = 0; i < 200; i++) {
        physics.update(state, 0.5);
      }

      expect(state.ball.velocity.magnitude()).toBeCloseTo(0, 1);
    });
  });

  describe("launch", () => {
    it("sets ball velocity toward target", () => {
      const state = buildMinimalMatchState();
      const ball = state.ball;
      // Ball starts near centre; target is the goal — clearly different position.
      (ball as any).position = new Vector2(52, 34);
      (ball as any).owner = null;
      const target = new Vector2(105, 34);

      physics.launch(ball, target, 25);

      expect(ball.velocity.magnitude()).toBeGreaterThan(0);
      expect(ball.state).toBe(BallState.IN_FLIGHT);
    });

    it("ball moves toward target after launch", () => {
      const state = buildMinimalMatchState();
      const ball = state.ball;
      (ball as any).position = new Vector2(10, 34);
      (ball as any).owner = null;
      const target = new Vector2(80, 34);

      physics.launch(ball, target, 25);
      const initialX = ball.position.x;

      physics.update(state, 0.5);
      expect(ball.position.x).toBeGreaterThan(initialX);
    });
  });

  describe("controlled ball", () => {
    it("ball tracks owner position when controlled", () => {
      const state = buildMinimalMatchState();
      const owner = state.home.players[0];
      owner.hasBall = true;
      (state.ball as any).owner = owner;
      (state.ball as any).state = BallState.CONTROLLED;

      owner.position = new Vector2(60, 34);
      physics.update(state, 0.5);

      expect(state.ball.position.x).toBe(60);
      expect(state.ball.position.y).toBe(34);
    });
  });

  describe("pitch boundary clamping", () => {
    it("ball does not exceed pitch length", () => {
      const state = buildMinimalMatchState();
      (state.ball as any).owner = null;
      (state.ball as any).state = BallState.FREE;
      (state.ball as any).position = new Vector2(104, 34);
      (state.ball as any).velocity = new Vector2(50, 0);

      for (let i = 0; i < 10; i++) {
        physics.update(state, 0.5);
      }

      expect(state.ball.position.x).toBeLessThanOrEqual(state.pitch.length);
    });
  });
});

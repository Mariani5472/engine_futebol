import { Vector2 } from "../../../core/geometry/Vector2";
import { BallMatchState, BallState } from "../../../core/movement/BallMatchState";
import { MatchState } from "../../../core/movement/MatchState";

/** Surface friction coefficient (fraction of velocity retained per second). */
const GROUND_FRICTION = 0.82;
/** Bounce energy retention (fraction of vertical speed retained on bounce). */
const BOUNCE_RESTITUTION = 0.55;
/** Gravity (m/s²). */
const GRAVITY = 9.81;
/** Height at which the ball is considered grounded. */
const GROUND_THRESHOLD = 0.05;
/** Speed below which the ball is considered stationary. */
const MIN_SPEED = 0.1;

export class BallPhysicsSystem {

  /**
   * Advances ball physics by one simulation step.
   * Called only when the ball is NOT controlled by a player.
   */
  public update(state: MatchState, deltaTime: number): void {

    const ball = state.ball;

    // Ball controlled: position tracks owner.
    if (ball.owner !== null || ball.state === BallState.CONTROLLED) {
      if (ball.owner) {
        ball.position = ball.owner.position;
        ball.velocity = ball.owner.velocity;
      }
      return;
    }

    this.applyGravity(ball, deltaTime);
    this.applyGroundFriction(ball, deltaTime);
    this.applyMovement(ball, deltaTime);
    this.clampToPitch(ball, state);
    this.checkRestState(ball);

  }

  private applyGravity(ball: BallMatchState, deltaTime: number): void {
    if (ball.height > GROUND_THRESHOLD) {
      // Ball is airborne: gravity pulls vertical component.
      // verticalVelocity is stored implicitly through height change.
      // We approximate with simple Euler integration.
      const newHeight = ball.height - (this.getVerticalSpeed(ball) * deltaTime);

      if (newHeight <= 0) {
        // Bounce
        this.bounce(ball);
      } else {
        (ball as { height: number }).height = newHeight;
      }
    }
  }

  /**
   * Extracts an approximate vertical descent speed from the ball's
   * current height (used for trajectory continuation after being kicked).
   * In a more complete physics model this would be tracked separately.
   */
  private getVerticalSpeed(_ball: BallMatchState): number {
    // Simple model: ball descends at gravity-influenced rate
    return GRAVITY * 0.15;
  }

  private bounce(ball: BallMatchState): void {
    (ball as { height: number }).height = 0;
    // Reduce horizontal velocity on bounce.
    const speed = ball.velocity.magnitude();
    if (speed > MIN_SPEED) {
      const retained = speed * BOUNCE_RESTITUTION;
      if (retained < MIN_SPEED) {
        (ball as { velocity: Vector2 }).velocity = Vector2.zero();
      } else {
        (ball as { velocity: Vector2 }).velocity =
          ball.velocity.normalize().multiply(retained);
      }
    }
  }

  private applyGroundFriction(ball: BallMatchState, deltaTime: number): void {
    if (ball.height > GROUND_THRESHOLD) return; // No friction in the air.

    const speed = ball.velocity.magnitude();
    if (speed < MIN_SPEED) {
      (ball as { velocity: Vector2 }).velocity = Vector2.zero();
      return;
    }

    const friction = Math.pow(GROUND_FRICTION, deltaTime);
    (ball as { velocity: Vector2 }).velocity = ball.velocity.multiply(friction);
  }

  private applyMovement(ball: BallMatchState, deltaTime: number): void {
    const displacement = ball.velocity.multiply(deltaTime);
    (ball as { position: Vector2 }).position = ball.position.add(displacement);
  }

  private clampToPitch(ball: BallMatchState, state: MatchState): void {
    const pitch = state.pitch;
    const pos = ball.position;
    const clamped = new Vector2(
      Math.max(0, Math.min(pitch.length, pos.x)),
      Math.max(0, Math.min(pitch.width, pos.y))
    );
    (ball as { position: Vector2 }).position = clamped;
  }

  private checkRestState(ball: BallMatchState): void {
    const speed = ball.velocity.magnitude();
    if (speed < MIN_SPEED && ball.height <= GROUND_THRESHOLD) {
      (ball as { velocity: Vector2 }).velocity = Vector2.zero();
      if (ball.state === BallState.IN_FLIGHT) {
        (ball as { state: BallState }).state = BallState.FREE;
      }
    }
  }

  /**
   * Launches the ball toward a target position.
   * Handles passes (low trajectory) and shots (can be elevated).
   */
  public launch(
    ball: BallMatchState,
    target: Vector2,
    power: number,
    height: number = 0
  ): void {

    const direction = target.subtract(ball.position).normalize();
    (ball as { velocity: Vector2 }).velocity = direction.multiply(power);
    (ball as { height: number }).height = height;
    (ball as { state: BallState }).state = BallState.IN_FLIGHT;
    (ball as { owner: null }).owner = null;

  }

}

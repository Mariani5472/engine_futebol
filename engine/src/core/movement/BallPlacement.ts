import type { Vector2 } from "../geometry/Vector2";
import { BallState, type BallMatchState } from "./BallMatchState";
import type { PlayerMatchState } from "./PlayerMatchState";

/** Centralizes atomic ball/owner placement without deciding when a restart occurs. */
export class BallPlacement {
  public static forKickoff(
    ball: BallMatchState,
    player: PlayerMatchState,
    position: Vector2,
    matchSecond: number,
  ): void {
    ball.release();
    ball.position = position;
    ball.previousPosition = position;
    ball.visualPosition = position;
    ball.velocity = ball.velocity.multiply(0);
    ball.visualVelocity = ball.visualVelocity.multiply(0);
    ball.height = 0;
    ball.visualHeight = 0;
    ball.motion = null;
    ball.pendingPass = null;
    player.hasBall = true;
    ball.acquirePossession(player, "RESTART", matchSecond);
    ball.state = BallState.CONTROLLED;
  }

  public static forSetPiece(
    ball: BallMatchState,
    player: PlayerMatchState,
    position: Vector2,
    matchSecond: number,
  ): void {
    ball.release();
    ball.motion = null;
    ball.pendingPass = null;
    ball.activeShot = null;
    ball.restrictedTouchPlayerId = null;
    ball.position = position;
    ball.previousPosition = position;
    ball.visualPosition = position;
    ball.velocity = ball.velocity.multiply(0);
    ball.visualVelocity = ball.visualVelocity.multiply(0);
    ball.height = 0;
    ball.visualHeight = 0;
    ball.acquirePossession(player, "RESTART", matchSecond);
    ball.state = BallState.CONTROLLED;
    player.hasBall = true;
  }

  public static forScenario(
    ball: BallMatchState,
    player: PlayerMatchState,
    position: Vector2,
  ): void {
    ball.release();
    ball.position = position;
    ball.previousPosition = position;
    ball.visualPosition = position;
    ball.velocity = ball.velocity.multiply(0);
    ball.visualVelocity = ball.visualVelocity.multiply(0);
    ball.height = 0;
    ball.visualHeight = 0;
    ball.owner = player;
    ball.state = BallState.CONTROLLED;
    ball.motion = null;
    ball.activeShot = null;
    ball.intendedReceiverId = null;
    ball.pendingPass = null;
    ball.restrictedTouchPlayerId = null;
    ball.lastCompletedPass = null;
    ball.lastTouchedPlayerId = player.player.id;
    ball.controlOffset = ball.controlOffset.multiply(0);
    player.hasBall = true;
  }

  public static freeForScenario(ball: BallMatchState, position: Vector2): void {
    ball.release();
    ball.position = position;
    ball.previousPosition = position;
    ball.visualPosition = position;
    ball.velocity = ball.velocity.multiply(0);
    ball.visualVelocity = ball.visualVelocity.multiply(0);
    ball.height = 0;
    ball.visualHeight = 0;
    ball.state = BallState.FREE;
    ball.motion = null;
    ball.activeShot = null;
    ball.intendedReceiverId = null;
    ball.pendingPass = null;
    ball.restrictedTouchPlayerId = null;
    ball.lastCompletedPass = null;
    ball.lastTouchedPlayerId = null;
    ball.controlOffset = ball.controlOffset.multiply(0);
  }

  public static holdAt(ball: BallMatchState, position: Vector2, controlOffset: Vector2): void {
    ball.position = position;
    ball.visualPosition = position;
    ball.velocity = ball.velocity.multiply(0);
    ball.visualVelocity = ball.visualVelocity.multiply(0);
    ball.controlOffset = controlOffset;
  }
}

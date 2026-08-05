import { Decision } from "./Decision";
import { DecisionContext } from "./DecisionContext";
import { DecisionType } from "./DecisionType";
import { BallState } from "../../../core/movement/BallMatchState";

/** Maximum reach distance for a tackle attempt (metres). */
const TACKLE_REACH_METRES = 3;

/**
 * Validates that a candidate decision is legal given the current
 * game context, then falls back gracefully when no legal options exist.
 */
export class DecisionFilter {
  public filter(
    decisions: Decision[],
    context: DecisionContext
  ): Decision[] {
    const legal = decisions.filter((d) => this.isLegal(d, context));

    if (legal.length > 0) {
      return legal;
    }

    // Fallback: hold ball if in possession, otherwise move to position.
    return [
      new Decision(
        context.player.hasBall ? DecisionType.HOLD_BALL : DecisionType.MOVE,
        1
      )
    ];
  }

  private isLegal(
    decision: Decision,
    context: DecisionContext
  ): boolean {
    const hasBall = context.player.hasBall;

    switch (decision.type) {
      // Ball-carrier actions — only when you have the ball.
      case DecisionType.PASS:
      case DecisionType.CROSS:
      case DecisionType.SHOT:
      case DecisionType.DRIBBLE:
      case DecisionType.HOLD_BALL:
      case DecisionType.CLEAR:
      case DecisionType.HEADER:
      case DecisionType.SKILL_MOVE:
      case DecisionType.RECEIVE:
      case DecisionType.SET_PIECE:
      case DecisionType.GK_CLAIM:
      case DecisionType.GK_DISTRIBUTE:
      case DecisionType.FAKE:
        return hasBall;

      case DecisionType.CONTROL:
        return !hasBall
          && (context.match.ball.state === BallState.FREE || context.match.ball.state === BallState.IN_FLIGHT)
          && context.player.position.distanceTo(context.match.ball.position) <= 3.5;

      // Defensive actions — only when you don't have the ball.
      case DecisionType.TACKLE:
      case DecisionType.INTERCEPT:
        return !hasBall && this.canReachBallCarrier(context);

      case DecisionType.BLOCK:
        return !hasBall;

      case DecisionType.PRESS:
      case DecisionType.COVER:
      case DecisionType.MARK:
      case DecisionType.MOVE:
      case DecisionType.POSITION:
        return !hasBall;

      case DecisionType.TACTICAL_FOUL:
        return !hasBall && this.canReachBallCarrier(context);

      // NONE is never legal.
      case DecisionType.NONE:
        return false;

      default:
        return decision.utility > 0;
    }
  }

  private canReachBallCarrier(context: DecisionContext): boolean {
    const ball = context.match.ball;
    if (!ball.owner) return false;

    const dist = context.player.position.distanceTo(ball.owner.position);
    return dist <= TACKLE_REACH_METRES;
  }
}

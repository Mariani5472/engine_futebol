import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";

/**
 * Evaluates whether an off-ball player should move to receive the ball.
 *
 * RECEIVE is only meaningful when the ball is free or in flight. The evaluator
 * favors players who are plausible recipients of the current ball trajectory,
 * while penalizing heavily contested receiving situations.
 */
export class ReceiveEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (player.hasBall) return [];
    if (match.ball.state !== BallState.IN_FLIGHT && match.ball.state !== BallState.FREE) {
      return [];
    }

    const team = match.home.players.includes(player)
      ? match.home
      : match.away;

    const opponents = match.home.players.includes(player)
      ? match.away.players
      : match.home.players;

    const score = this.calculateUtility(player, match, opponents);

    if (score < 20) return [];

    return [new Decision(DecisionType.RECEIVE, score)];
  }

  private calculateUtility(
    player: PlayerMatchState,
    match: DecisionContext["match"],
    opponents: PlayerMatchState[]
  ): number {
    const ball = match.ball;
    const distanceToBall = player.position.distanceTo(ball.position);

    if (distanceToBall > 18) return 0;

    const distanceScore = Math.max(0, 30 - distanceToBall * 2.2);

    const trajectoryScore = this.calculateTrajectoryScore(player, ball.velocity);
    const spaceScore = this.calculateSpaceScore(player, opponents);
    const technicalScore = this.calculateTechnicalQuality(player);
    const pressurePenalty = this.calculatePressurePenalty(player, opponents);

    return Math.max(
      0,
      distanceScore +
        trajectoryScore +
        spaceScore +
        technicalScore -
        pressurePenalty
    );
  }

  private calculateTrajectoryScore(
    player: PlayerMatchState,
    velocity: { x: number; y: number }
  ): number {
    const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);

    if (speed < 0.1) return 8;

    const toBall = player.position.subtract(player.targetPosition);
    const dot = toBall.x * velocity.x + toBall.y * velocity.y;
    const magnitude = Math.sqrt(toBall.x ** 2 + toBall.y ** 2) * speed;

    if (magnitude === 0) return 8;

    const alignment = dot / magnitude;
    return Math.max(0, alignment) * 18;
  }

  private calculateSpaceScore(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestOpponent = opponents.reduce(
      (nearest, opponent) =>
        Math.min(nearest, player.position.distanceTo(opponent.position)),
      Infinity
    );

    if (nearestOpponent >= 8) return 18;
    if (nearestOpponent >= 5) return 12;
    if (nearestOpponent >= 3) return 6;
    return 0;
  }

  private calculateTechnicalQuality(player: PlayerMatchState): number {
    const technique = player.player.attributes.technical.technique / 20;
    const firstTouch = player.player.attributes.technical.firstTouch / 20;

    return technique * 8 + firstTouch * 12;
  }

  private calculatePressurePenalty(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    return opponents.reduce((penalty, opponent) => {
      const distance = player.position.distanceTo(opponent.position);

      if (distance < 2) return penalty + 18;
      if (distance < 4) return penalty + 10;
      if (distance < 6) return penalty + 4;

      return penalty;
    }, 0);
  }
}

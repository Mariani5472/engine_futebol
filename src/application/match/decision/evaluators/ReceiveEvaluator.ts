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

    if (
      match.ball.state !== BallState.IN_FLIGHT &&
      match.ball.state !== BallState.FREE
    ) {
      return [];
    }

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
    const trajectoryScore = this.calculateTrajectoryScore(
      player,
      ball.velocity.x,
      ball.velocity.y
    );
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
    velocityX: number,
    velocityY: number
  ): number {
    const speed = Math.sqrt(velocityX ** 2 + velocityY ** 2);

    if (speed < 0.1) return 8;

    const toBall = player.position.subtract(player.targetPosition);
    const magnitude = Math.sqrt(toBall.x ** 2 + toBall.y ** 2) * speed;

    if (magnitude === 0) return 8;

    const alignment =
      (toBall.x * velocityX + toBall.y * velocityY) / magnitude;

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
    const anticipation = player.player.attributes.mental.anticipation / 20;
    const composure = player.player.attributes.mental.composure / 20;

    return technique * 8 + anticipation * 8 + composure * 4;
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

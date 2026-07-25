import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";

/**
 * Evaluates the first touch / ball control action.
 *
 * CONTROL is only a valid candidate when the player is about to receive an
 * airborne or free ball. It is deliberately separated from RECEIVE:
 * RECEIVE means getting into position to receive the ball, while CONTROL
 * means attempting to secure the first touch once the ball is reachable.
 */
export class ControlEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    const ball = match.ball;

    if (player.hasBall) return [];

    if (
      ball.state !== BallState.IN_FLIGHT &&
      ball.state !== BallState.FREE
    ) {
      return [];
    }

    const distanceToBall = player.position.distanceTo(ball.position);

    if (distanceToBall > 3.5) return [];

    const isHome = match.home.players.includes(player);
    const opponents = isHome ? match.away.players : match.home.players;

    const score = this.calculateUtility(
      player,
      ball.height,
      distanceToBall,
      opponents
    );

    if (score < 20) return [];

    return [new Decision(DecisionType.CONTROL, score)];
  }

  private calculateUtility(
    player: PlayerMatchState,
    ballHeight: number,
    distanceToBall: number,
    opponents: PlayerMatchState[]
  ): number {
    const attrs = player.player.attributes;

    const technique = attrs.technical.technique / 20;
    const anticipation = attrs.mental.anticipation / 20;
    const composure = attrs.mental.composure / 20;

    const controlQuality =
      technique * 0.45 +
      anticipation * 0.30 +
      composure * 0.25;

    const proximityScore = Math.max(0, 36 - distanceToBall * 10);
    const aerialControlBonus = ballHeight > 1.2 ? 8 : 0;
    const pressurePenalty = this.calculatePressurePenalty(player, opponents);

    return Math.max(
      0,
      proximityScore +
        controlQuality * 35 +
        aerialControlBonus -
        pressurePenalty
    );
  }

  private calculatePressurePenalty(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    return opponents.reduce((penalty, opponent) => {
      const distance = player.position.distanceTo(opponent.position);

      if (distance < 1.5) return penalty + 25;
      if (distance < 3) return penalty + 15;
      if (distance < 5) return penalty + 6;

      return penalty;
    }, 0);
  }
}

import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";

/**
 * Evaluates aerial contests and attacking/defensive headers.
 *
 * HEADER is an off-ball decision: the player must be close enough to the
 * airborne ball to realistically contest it. The evaluator intentionally
 * requires a meaningful aerial situation so headers do not become a generic
 * alternative to RECEIVE or CONTROL.
 */
export class HeaderEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    const ball = match.ball;

    if (player.hasBall) return [];
    if (ball.state !== BallState.IN_FLIGHT && ball.state !== BallState.FREE) {
      return [];
    }

    if (ball.height < 0.7) return [];

    const distanceToBall = player.position.distanceTo(ball.position);
    if (distanceToBall > 5) return [];

    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const score = this.calculateUtility(
      player,
      ball.height,
      distanceToBall,
      ball.velocity.x,
      ball.velocity.y,
      team.attackingDirection,
      opponents
    );

    if (score < 20) return [];

    return [new Decision(DecisionType.HEADER, score)];
  }

  private calculateUtility(
    player: PlayerMatchState,
    ballHeight: number,
    distanceToBall: number,
    velocityX: number,
    velocityY: number,
    attackingDirection: 1 | -1,
    opponents: PlayerMatchState[]
  ): number {
    const attrs = player.player.attributes;

    const heading = attrs.technical.heading / 20;
    const jumpingReach = attrs.physical.jumpingReach / 20;
    const anticipation = attrs.mental.anticipation / 20;
    const bravery = attrs.mental.bravery / 20;

    const aerialAbility =
      heading * 0.4 +
      jumpingReach * 0.3 +
      anticipation * 0.2 +
      bravery * 0.1;

    const distanceScore = Math.max(0, 30 - distanceToBall * 6);
    const heightScore = Math.min(18, ballHeight * 8);
    const aerialQualityScore = aerialAbility * 30;

    const ballSpeed = Math.sqrt(velocityX ** 2 + velocityY ** 2);
    const contestScore = ballSpeed > 2 ? 8 : 0;

    const pressure = this.calculatePressure(player, opponents);
    const pressurePenalty = pressure * 10;

    const attackingDirectionScore = this.calculateDirectionScore(
      player,
      attackingDirection
    );

    return Math.max(
      0,
      distanceScore +
        heightScore +
        aerialQualityScore +
        contestScore +
        attackingDirectionScore -
        pressurePenalty
    );
  }

  private calculatePressure(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestOpponent = opponents.reduce(
      (nearest, opponent) =>
        Math.min(nearest, player.position.distanceTo(opponent.position)),
      Infinity
    );

    if (nearestOpponent < 1.5) return 1;
    if (nearestOpponent < 3) return 0.6;
    if (nearestOpponent < 5) return 0.25;

    return 0;
  }

  private calculateDirectionScore(
    player: PlayerMatchState,
    attackingDirection: 1 | -1
  ): number {
    const forwardVelocity = player.velocity.x * attackingDirection;

    if (forwardVelocity > 1) return 8;
    if (forwardVelocity > 0) return 4;

    return 0;
  }
}

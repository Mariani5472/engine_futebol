import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { ActionReadiness } from "./ActionReadiness";

export class ControlEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    const ball = match.ball;

    if (player.hasBall) return [];
    if (ball.state !== BallState.IN_FLIGHT && ball.state !== BallState.FREE) return [];

    const distanceToBall = player.position.distanceTo(ball.position);
    if (distanceToBall > 3.5) return [];

    const isHome = match.home.players.includes(player);
    const opponents = isHome ? match.away.players : match.home.players;
    const score = this.calculateUtility(player, ball.height, distanceToBall, opponents);

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
    const firstTouch = attrs.technical.firstTouch / 20;

    const controlQuality =
      technique * 0.30 +
      firstTouch * 0.35 +
      anticipation * 0.20 +
      composure * 0.15;

    const pressure = ActionReadiness.opponentPressure(player, opponents);
    const nearestOpponentDistance = this.nearestOpponentDistance(player, opponents);
    const pressurePenalty = pressure * 22;
    const bodyQuality = this.bodyQuality(player);
    const orientationQuality = this.orientationQuality(player, opponents);

    const proximityScore = Math.max(0, 36 - distanceToBall * 10);
    const aerialControlBonus = ballHeight > 1.2 ? 8 : 0;
    const firstTouchQuality = controlQuality * 35 * bodyQuality * orientationQuality;
    const pressureEscapeBonus = this.calculatePressureEscapeBonus(
      firstTouch,
      composure,
      nearestOpponentDistance,
    );

    return Math.max(
      0,
      proximityScore +
        firstTouchQuality +
        aerialControlBonus +
        pressureEscapeBonus -
        pressurePenalty
    );
  }

  private calculatePressureEscapeBonus(
    firstTouch: number,
    composure: number,
    nearestOpponentDistance: number,
  ): number {
    if (nearestOpponentDistance > 5) return 0;
    return (firstTouch * 0.6 + composure * 0.4) * 12;
  }

  private bodyQuality(player: PlayerMatchState): number {
    const bodyStateQuality = {
      STANDING: 1,
      BALANCED: 1,
      LEANING: 0.78,
      FALLING: 0.25,
      GROUND: 0,
    }[player.bodyState];

    const balance = this.normalize(player.balance);
    const stability = this.normalize(player.stability);
    return Math.max(0, Math.min(1, bodyStateQuality * 0.45 + balance * 0.3 + stability * 0.25));
  }

  private orientationQuality(player: PlayerMatchState, opponents: PlayerMatchState[]): number {
    const nearest = opponents.reduce((closest, opponent) => {
      const distance = player.position.distanceTo(opponent.position);
      return distance < closest.distance ? { opponent, distance } : closest;
    }, { opponent: undefined as PlayerMatchState | undefined, distance: Infinity });

    if (!nearest.opponent) return 1;
    const toOpponent = nearest.opponent.position.subtract(player.position);
    return ActionReadiness.orientationQuality(player.facingDirection, toOpponent) * 0.35 + 0.65;
  }

  private nearestOpponentDistance(player: PlayerMatchState, opponents: PlayerMatchState[]): number {
    return opponents.reduce((nearest, opponent) => {
      return Math.min(nearest, player.position.distanceTo(opponent.position));
    }, Infinity);
  }

  private normalize(value: number): number {
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}
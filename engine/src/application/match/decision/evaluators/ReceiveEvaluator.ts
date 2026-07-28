import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { ActionReadiness } from "./ActionReadiness";

export class ReceiveEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    if (player.hasBall) return [];

    if (match.ball.state !== BallState.IN_FLIGHT && match.ball.state !== BallState.FREE) {
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
    const trajectoryScore = this.calculateTrajectoryScore(player, ball.velocity.x, ball.velocity.y);
    const spaceScore = this.calculateSpaceScore(player, opponents);
    const technicalScore = this.calculateTechnicalQuality(player);
    const pressure = ActionReadiness.opponentPressure(player, opponents);
    const pressurePenalty = this.calculatePressurePenalty(pressure, player, opponents);
    const bodyQuality = this.bodyQuality(player);
    const orientationQuality = this.calculateReceivingOrientation(player, ball.position);

    const firstTouchReadiness = technicalScore * bodyQuality * orientationQuality;
    const escapeSpaceBonus = this.calculateEscapeSpaceBonus(player, opponents);

    return Math.max(
      0,
      distanceScore +
        trajectoryScore +
        spaceScore +
        firstTouchReadiness +
        escapeSpaceBonus -
        pressurePenalty
    );
  }

  private calculateTrajectoryScore(
    player: PlayerMatchState,
    velocityX: number,
    velocityY: number
  ): number {
    const speed = Math.hypot(velocityX, velocityY);
    if (speed < 0.1) return 8;

    const toBall = player.position.subtract(player.targetPosition);
    const magnitude = Math.hypot(toBall.x, toBall.y) * speed;
    if (magnitude === 0) return 8;

    const alignment = (toBall.x * velocityX + toBall.y * velocityY) / magnitude;
    return Math.max(0, alignment) * 18;
  }

  private calculateSpaceScore(player: PlayerMatchState, opponents: PlayerMatchState[]): number {
    const nearestOpponent = this.nearestOpponentDistance(player, opponents);
    if (nearestOpponent >= 8) return 18;
    if (nearestOpponent >= 5) return 12;
    if (nearestOpponent >= 3) return 6;
    return 0;
  }

  private calculateTechnicalQuality(player: PlayerMatchState): number {
    const attrs = player.player.attributes;
    const technical = attrs.technical as unknown as Record<string, number>;
    const technique = (technical.firstTouch ?? technical.technique ?? 10) / 20;
    const anticipation = attrs.mental.anticipation / 20;
    const composure = attrs.mental.composure / 20;

    return technique * 10 + anticipation * 6 + composure * 4;
  }

  private calculatePressurePenalty(
    pressure: number,
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestDistance = this.nearestOpponentDistance(player, opponents);
    const base = pressure * 20;

    if (nearestDistance < 2) return base + 18;
    if (nearestDistance < 4) return base + 10;
    if (nearestDistance < 6) return base + 4;
    return base;
  }

  private calculateEscapeSpaceBonus(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestDistance = this.nearestOpponentDistance(player, opponents);
    if (nearestDistance >= 8) return 10;
    if (nearestDistance >= 5) return 6;
    return 0;
  }

  private calculateReceivingOrientation(
    player: PlayerMatchState,
    ballPosition: { x: number; y: number }
  ): number {
    const desiredDirection = ballPosition.subtract(player.position);
    return ActionReadiness.orientationQuality(player.facingDirection, desiredDirection);
  }

  private bodyQuality(player: PlayerMatchState): number {
    const stateQuality = {
      STANDING: 1,
      BALANCED: 1,
      LEANING: 0.78,
      FALLING: 0.25,
      GROUND: 0,
    }[player.bodyState];

    const normalize = (value: number) => value <= 1 ? Math.max(0, value) : Math.min(1, value / 100);
    return Math.max(0, Math.min(1, stateQuality * 0.45 + normalize(player.balance) * 0.3 + normalize(player.stability) * 0.25));
  }

  private nearestOpponentDistance(player: PlayerMatchState, opponents: PlayerMatchState[]): number {
    return opponents.reduce((nearest, opponent) => {
      return Math.min(nearest, player.position.distanceTo(opponent.position));
    }, Infinity);
  }
}
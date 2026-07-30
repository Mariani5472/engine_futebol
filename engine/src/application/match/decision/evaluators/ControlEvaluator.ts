import { BallState } from "../../../../core/movement/BallMatchState";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { ActionReadiness } from "./ActionReadiness";

export class ControlEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    const ball = match.ball;

    if (player.hasBall) return [];
    if (ball.state !== BallState.IN_FLIGHT && ball.state !== BallState.FREE) return [];

    const distanceToBall = player.position.distanceTo(ball.position);
    if (distanceToBall > 3.5) return [];

    const score = this.calculateUtility(context, ball.height, distanceToBall);
    if (score.total < 20) return [];
    return [
      new Decision(
        DecisionType.CONTROL,
        score.total,
        undefined,
        score.reasons,
        score.components,
      ),
    ];
  }

  private calculateUtility(
    context: DecisionContext,
    ballHeight: number,
    distanceToBall: number,
  ): UtilityScore {
    const player = context.player;
    const world = context.world;
    const attrs = player.player.attributes;
    const technical = attrs.technical as unknown as Record<string, number>;
    const technique = (technical.technique ?? 10) / 20;
    const firstTouch = (technical.firstTouch ?? technical.technique ?? 10) / 20;
    const anticipation = (attrs.mental.anticipation ?? 10) / 20;
    const composure = (attrs.mental.composure ?? 10) / 20;

    const controlQuality =
      technique * 0.25 +
      firstTouch * 0.40 +
      anticipation * 0.20 +
      composure * 0.15;

    const pressure = world?.pressure ?? ActionReadiness.opponentPressure(
      player,
      world?.opponents ? [...world.opponents] : [],
    );
    const nearestOpponentDistance = world?.nearestOpponentDistance ?? Infinity;
    const pressurePenalty = pressure * 22;
    const bodyQuality = ActionReadiness.bodyQualityOf(player);
    const orientationQuality = this.orientationQuality(player, world?.opponents ?? []);

    const proximityScore = Math.max(0, 36 - distanceToBall * 10);
    const aerialControlBonus = ballHeight > 1.2 ? 8 : 0;
    const firstTouchQuality = controlQuality * 35 * bodyQuality * orientationQuality;
    const pressureEscapeBonus = this.calculatePressureEscapeBonus(
      firstTouch,
      composure,
      nearestOpponentDistance,
    );

    return UtilityScore.fromComponents({
      SPACE: proximityScore + aerialControlBonus,
      TECHNIQUE: firstTouchQuality,
      PRESSURE: pressureEscapeBonus - pressurePenalty,
      BODY: bodyQuality * 8,
    });
  }

  private calculatePressureEscapeBonus(
    firstTouch: number,
    composure: number,
    nearestOpponentDistance: number,
  ): number {
    if (!Number.isFinite(nearestOpponentDistance) || nearestOpponentDistance > 5) return 0;
    return (firstTouch * 0.6 + composure * 0.4) * 12;
  }

  private orientationQuality(
    player: PlayerMatchState,
    opponents: readonly PlayerMatchState[],
  ): number {
    const nearest = opponents.reduce(
      (closest, opponent) => {
        const distance = player.position.distanceTo(opponent.position);
        return distance < closest.distance ? { opponent, distance } : closest;
      },
      { opponent: undefined as PlayerMatchState | undefined, distance: Infinity },
    );

    if (!nearest.opponent) return 1;
    const toOpponent = nearest.opponent.position.subtract(player.position);
    return ActionReadiness.orientationQuality(player.facingDirection, toOpponent) * 0.35 + 0.65;
  }
}

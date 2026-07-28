import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * POSITION is a structural off-ball action: the player holds a tactical spot
 * to preserve shape, passing lanes and defensive balance.
 */
export class PositionEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (context.player.hasBall) return [];

    const score = this.calculateUtility(context);
    if (score.total < 9) return [];

    return [new Decision(DecisionType.POSITION, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const target = player.targetPosition;
    const distanceToTarget = player.position.distanceTo(target);
    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      const distance = player.position.distanceTo(opponent.position);
      return Math.min(nearest, distance);
    }, Infinity);

    const nearestTeammateDistance = team.players.reduce((nearest, teammate) => {
      if (teammate === player) return nearest;
      const distance = player.position.distanceTo(teammate.position);
      return Math.min(nearest, distance);
    }, Infinity);

    const ballDistance = player.position.distanceTo(match.ball.position);
    const positioning = player.player.attributes.mental.positioning / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const anticipation = player.player.attributes.mental.anticipation / 20;
    const concentration = player.player.attributes.mental.concentration / 20;

    const structureScore = Math.max(0, 14 - distanceToTarget * 1.1);
    const spacingScore = Number.isFinite(nearestTeammateDistance)
      ? Math.max(0, Math.min(8, nearestTeammateDistance / 3))
      : 0;
    const dangerScore = Number.isFinite(nearestOpponentDistance)
      ? Math.max(0, 10 - nearestOpponentDistance * 1.6)
      : 0;
    const ballRelationScore = Math.max(0, Math.min(6, ballDistance / 20));
    const fatigueModifier = Math.max(0.7, 1 - player.fatigue / 180);

    const total = Math.max(
      0,
      (positioning * 18 + decisions * 8 + anticipation * 6 + concentration * 6 + structureScore + spacingScore + dangerScore + ballRelationScore) *
        fatigueModifier
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "POSITIONING", value: positioning * 18 },
      { code: "DECISIONS", value: decisions * 8 },
      { code: "ANTICIPATION", value: anticipation * 6 },
      { code: "CONCENTRATION", value: concentration * 6 },
      { code: "STRUCTURE", value: structureScore },
      { code: "SPACING", value: spacingScore },
      { code: "DANGER", value: dangerScore },
      { code: "BALL_RELATION", value: ballRelationScore },
    ]);
  }
}

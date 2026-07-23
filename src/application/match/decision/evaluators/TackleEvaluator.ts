import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

export class TackleEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {

    const ball = context.match.ball;
    if (!ball.owner) return [];

    // Only tackle the ball carrier if they are an opponent.
    const isHome = context.match.home.players.includes(context.player);
    const ownerIsOpponent = isHome
      ? context.match.away.players.includes(ball.owner)
      : context.match.home.players.includes(ball.owner);

    if (!ownerIsOpponent) return [];

    const distance = context.player.position.distanceTo(ball.owner.position);
    if (distance > 5) return []; // Too far to consider tackling.

    const score = this.calculateUtility(context, distance);
    return [new Decision(DecisionType.TACKLE, score.total)];
  }

  private calculateUtility(context: DecisionContext, distance: number): UtilityScore {
    const attrs = context.player.player.attributes;
    const tackling = attrs.technical.tackling;
    const aggression = attrs.mental.aggression;
    const positioning = attrs.mental.positioning;

    // Closer = more urgent tackle.
    const proximityBonus = Math.max(0, 20 - distance * 4);

    const base = tackling * 1.2 + aggression * 0.5 + positioning * 0.3 + proximityBonus;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "TACKLING", value: tackling },
      { code: "PROXIMITY", value: proximityBonus }
    ]);
  }

}

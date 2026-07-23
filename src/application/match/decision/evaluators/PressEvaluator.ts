import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

export class PressEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (context.player.hasBall) return [];

    const ball = context.match.ball;
    if (!ball.owner) return [];

    const isHome = context.match.home.players.includes(context.player);
    const ownerIsOpponent = isHome
      ? context.match.away.players.includes(ball.owner)
      : context.match.home.players.includes(ball.owner);

    if (!ownerIsOpponent) return [];

    const distance = context.player.position.distanceTo(ball.owner.position);
    if (distance > 15) return []; // Too far to press.

    const score = this.calculateUtility(context, distance);
    return [new Decision(DecisionType.PRESS, score.total)];
  }

  private calculateUtility(context: DecisionContext, distance: number): UtilityScore {
    const attrs = context.player.player.attributes;
    const workRate = attrs.mental.workRate;
    const aggression = attrs.mental.aggression;

    const proximityBonus = Math.max(0, 15 - distance * 2);
    const base = workRate * 0.8 + aggression * 0.4 + proximityBonus;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "WORK_RATE", value: workRate },
      { code: "PROXIMITY", value: proximityBonus }
    ]);
  }

}

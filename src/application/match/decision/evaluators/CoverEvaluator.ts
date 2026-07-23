import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * Cover: defensive player positions themselves to protect space
 * between the ball and their own goal — rather than pressing directly.
 */
export class CoverEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (context.player.hasBall) return [];

    const ball = context.match.ball;
    if (!ball.owner) return [];

    // Only defenders cover.
    const role = context.player.currentRole;
    const isDefender =
      role === "CENTRE_BACK" ||
      role === "FULL_BACK" ||
      role === "WING_BACK" ||
      role === "DEFENSIVE_MIDFIELDER" ||
      role === "GOALKEEPER";

    if (!isDefender) return [];

    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.COVER, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const positioning = attrs.mental.positioning;
    const decisions = attrs.mental.decisions;
    const concentration = attrs.mental.concentration;

    const base = positioning * 1.3 + decisions * 0.5 + concentration * 0.3;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "POSITIONING", value: positioning },
      { code: "DECISIONS", value: decisions }
    ]);
  }

}

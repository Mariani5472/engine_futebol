import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

export class HoldBallEvaluator
  implements ActionEvaluator {

  public evaluate(
    context: DecisionContext
  ): Decision[] {

    const score = this.calculateUtility(context);

    return [
      new Decision(
        DecisionType.HOLD_BALL,
        score.total,
      )
    ];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {

    const composure = context.player.player.attributes.mental.composure;

    return new UtilityScore(
      20,
      0,
      composure,
      0,
      [
        {
          code: "COMPOSURE",
          value: composure
        }
      ]
    );
  }
}
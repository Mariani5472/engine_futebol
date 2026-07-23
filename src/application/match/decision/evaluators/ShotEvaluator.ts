import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
export class ShotEvaluator
  implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const score = this.calculateUtility(context);
    return [
      new Decision(
        DecisionType.SHOT,
        score.total
      )
    ];
  }
  private calculateUtility(context: DecisionContext): UtilityScore {
    const technical = context.player.player.attributes.technical;
    const mental = context.player.player.attributes.mental;
    const finishing = technical.finishing;
    const composure = mental.composure;
    const base = finishing * 2 + composure;
    return new UtilityScore(
      base,
      0,
      0,
      0,
      [
        {
          code: "FINISHING",
          value: finishing
        },
        {
          code: "COMPOSURE",
          value: composure
        }
      ]
    );
  }
}
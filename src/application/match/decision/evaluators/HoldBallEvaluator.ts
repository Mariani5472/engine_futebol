import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * Hold Ball evaluator.
 *
 * Holding the ball is a LOW-priority fallback option — useful when under heavy
 * pressure and no good pass/shot is available, but should never beat a clear
 * shooting opportunity or a progressive pass. Base is intentionally modest
 * (~25) so that a striker near goal (shot utility 80-120) strongly prefers
 * shooting.
 */
export class HoldBallEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    const score = this.calculateUtility(context);
    return [new Decision(DecisionType.HOLD_BALL, score.total)];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const composure = attrs.mental.composure / 20;  // normalised 0-1
    const strength = attrs.physical.strength / 20;

    // Low base: hold-ball is only the best choice when nothing else is viable.
    // Composure and strength make shielding more effective under pressure.
    const base = 12 + composure * 8 + strength * 5;

    return new UtilityScore(base, 0, 0, 0, [
      { code: "COMPOSURE", value: composure * 8 },
      { code: "STRENGTH", value: strength * 5 }
    ]);
  }
}

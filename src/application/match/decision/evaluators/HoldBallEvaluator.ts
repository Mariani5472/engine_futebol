import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * Hold ball is the safe option under pressure when pass/shot lanes are poor.
 * Must beat mindless dribbling into traffic, but stay below clear shots.
 */
export class HoldBallEvaluator implements ActionEvaluator {

  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];

    const score = this.calculateUtility(context);
    if (score.total <= 0) return [];

    return [
      new Decision(
        DecisionType.HOLD_BALL,
        score.total,
        undefined,
        score.reasons,
        score.components,
      ),
    ];
  }

  private calculateUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const world = context.world;

    const composure = (attrs.mental.composure ?? 10) / 20;
    const strength = (attrs.physical.strength ?? 10) / 20;
    const balance = this.normalize(context.player.balance ?? 100);
    const stability = this.normalize(context.player.stability ?? 100);

    const pressure = world.pressure;
    const freeSpace = world.freeSpace;

    // Base shielding skill.
    const technique = composure * 14 + strength * 10;
    const body = balance * 8 + stability * 6;

    // Pressure is the main reason to hold — rises steeply when closed down.
    const pressureValue = pressure * 36;

    // Open pitch: holding is a waste of possession.
    const openPitchPenalty = freeSpace > 0.55 ? -(freeSpace * 18) : 0;

    // After a failed progressive action, holding stabilises.
    const recoveryBonus =
      context.player.lastActionType === DecisionType.DRIBBLE && pressure > 0.4
        ? 12
        : 0;

    return UtilityScore.fromComponents({
      TECHNIQUE: technique,
      BODY: body,
      PRESSURE: pressureValue,
      SPACE: openPitchPenalty,
      TACTICAL: recoveryBonus,
    });
  }

  private normalize(value: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}

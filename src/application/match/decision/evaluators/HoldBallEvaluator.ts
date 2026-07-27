import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * Hold ball is the safe option under pressure when pass/shot lanes are poor.
 * Under zero pressure / open pitch it must not dominate possession ticks.
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

    // Without meaningful pressure, holding is almost never correct.
    if (pressure < 0.25 && freeSpace > 0.4) {
      return UtilityScore.fromComponents({ SPACE: 0 });
    }

    const technique = composure * 12 + strength * 8;
    const body = balance * 6 + stability * 5;

    // Pressure is the main reason to hold — steep when closed down.
    const pressureValue = pressure * 40;

    // Open pitch: holding wastes possession.
    const openPitchPenalty = freeSpace > 0.45 ? -(freeSpace * 28) : 0;

    // Repeat HOLD under low pressure collapses utility further.
    const repeatHoldPenalty =
      context.player.lastActionType === DecisionType.HOLD_BALL && pressure < 0.45
        ? -18
        : 0;

    const recoveryBonus =
      context.player.lastActionType === DecisionType.DRIBBLE && pressure > 0.4
        ? 12
        : 0;

    return UtilityScore.fromComponents({
      TECHNIQUE: technique,
      BODY: body,
      PRESSURE: pressureValue,
      SPACE: openPitchPenalty,
      TACTICAL: recoveryBonus + repeatHoldPenalty,
    });
  }

  private normalize(value: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}

import {
  PersonalityModifier,
} from "./personality/PersonalityModifier";
import { UtilityScore } from "./UtilityScore";
import { UtilityContext } from "./UtilityContext";
import { UtilityComponent } from "./UtilityComponent";

export abstract class UtilityCalculator {

  constructor(
    private readonly personality:
      PersonalityModifier
  ) {}

  public calculate(
    context: UtilityContext
  ): UtilityScore {

    const base = this.calculateBase(
      context
    );

    const tactical = this.calculateTactical(
      context
    );

    const personalityBias = this.personality.calculate({
      player: context.decision.player,
      decisionType: context.decision.decision.type,
    });

    return new UtilityScore(

      base.value,

      tactical.value,

      personalityBias.utilityModifier,

      [
        ...base.reasons,

        ...tactical.reasons,

        ...personalityBias.reasons.map(
          reason => ({
            code: reason,
            value: personalityBias.utilityModifier,
          })
        ),
      ]
    );
  }

  protected abstract calculateBase(context: UtilityContext): UtilityComponent;
  protected abstract calculateTactical(context: UtilityContext): UtilityComponent;
}
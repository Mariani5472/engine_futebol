import { UtilityContext } from "./UtilityContext";
import { UtilityScore } from "./UtilityScore";
import { UtilityComponent } from "./UtilityComponent";

export abstract class UtilityCalculator {

  public calculate(
    context: UtilityContext
  ): UtilityScore {

    const base =
      this.calculateBase(context);

    const tactical =
      this.calculateTactical(context);

    const personality =
      this.calculatePersonality(context);

    const risk =
      this.calculateRisk(context);

    return new UtilityScore(

      base.value,

      tactical.value,

      personality.value,

      risk.value,

      [

        ...base.reasons,

        ...tactical.reasons,

        ...personality.reasons,

        ...risk.reasons

      ]

    );

  }

  protected abstract calculateBase(
    context: UtilityContext
  ): UtilityComponent;

  protected abstract calculateTactical(
    context: UtilityContext
  ): UtilityComponent;

  protected abstract calculatePersonality(
    context: UtilityContext
  ): UtilityComponent;

  protected abstract calculateRisk(
    context: UtilityContext
  ): UtilityComponent;

}
import { DecisionType } from "../DecisionType";
import { PersonalityBias } from "./PersonalityBias";
import { PersonalityContext } from "./PersonalityContext";
import { PersonalityModifier } from "./PersonalityModifier";

export class DefaultPersonalityModifier implements PersonalityModifier {

  public calculate(context: PersonalityContext): PersonalityBias {

    const utilityModifier = this.calculateUtilityModifier(context);

    const riskToleranceModifier = this.calculateRiskToleranceModifier(
      context
    );

    return new PersonalityBias(
      this.clamp(utilityModifier, -15, 15),
      this.clamp(riskToleranceModifier, -10, 10),
      [
        `PERSONALITY_UTILITY:${utilityModifier}`,
        `PERSONALITY_RISK_TOLERANCE:${riskToleranceModifier}`
      ]
    );
  }

  private calculateUtilityModifier(
    context: PersonalityContext
  ): number {

    const mental = context.player.player.attributes.mental;
    const hidden = context.player.player.attributes.hidden;
    let modifier = 0;

    switch (context.decisionType) {

      case DecisionType.DRIBBLE:
        modifier += this.center(mental.flair) * 0.8;
        modifier += this.center(mental.bravery) * 0.3;

        break;

      case DecisionType.SHOT:
        modifier += this.center(mental.flair) * 0.4;
        modifier += this.center(hidden.ambition) * 0.5;
        modifier += this.center(mental.bravery) * 0.3;

        break;

      case DecisionType.PASS:
        modifier += this.center(mental.teamwork) * 0.4;
        modifier += this.center(mental.decisions) * 0.5;
        modifier -= this.center(mental.flair) * 0.2;

        break;

      case DecisionType.HOLD_BALL:
        modifier += this.center(mental.composure) * 0.6;
        modifier += this.center(hidden.temperament) * 0.3;

        break;
    }

    return modifier;

  }

  private calculateRiskToleranceModifier(
    context: PersonalityContext
  ): number {

    const mental =
      context.player.player.attributes.mental;

    const hidden =
      context.player.player.attributes.hidden;

    let tolerance = 0;

    tolerance +=
      this.center(
        mental.bravery
      ) * 0.35;

    tolerance +=
      this.center(
        mental.flair
      ) * 0.30;

    tolerance +=
      this.center(
        hidden.temperament
      ) * 0.20;

    tolerance +=
      this.center(
        hidden.pressure
      ) * 0.15;

    switch (
    context.decisionType
    ) {

      case DecisionType.DRIBBLE:

        tolerance +=
          this.center(
            mental.flair
          ) * 0.25;

        break;

      case DecisionType.SHOT:

        tolerance +=
          this.center(
            mental.bravery
          ) * 0.20;

        break;

    }

    return tolerance;

  }

  private center(
    value: number
  ): number {
    return value - 10.5;
  }

  private clamp(
    value: number,
    min: number,
    max: number
  ): number {
    return Math.max(min, Math.min(
      max,
      value
    ));
  }
}
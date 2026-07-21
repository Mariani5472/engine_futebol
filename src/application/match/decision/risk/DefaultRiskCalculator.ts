import { DecisionType } from "../DecisionType";
import { RiskCalculator } from "./RiskCalculator";
import { RiskContext } from "./RiskContext";

export class DefaultRiskCalculator
  extends RiskCalculator {

  protected calculateFailureProbability(
    context: RiskContext
  ): number {

    const decision =
      context.decision;

    switch (decision.type) {
      case DecisionType.PASS:
        return this.calculatePassFailureProbability(
          context
        );

      case DecisionType.SHOT:
        return this.calculateShotFailureProbability(
          context
        );

      case DecisionType.DRIBBLE:
        return 0.35;

      case DecisionType.TACKLE:
        return 0.30;

      default:
        return 0.20;

    }

  }

  protected calculateConsequenceSeverity(
    context: RiskContext
  ): number {

    const player =
      context.player;

    const zone =
      player.currentZone;

    switch (zone) {

      case "DEFENSIVE_THIRD":
        return 0.9;

      case "MIDDLE_THIRD":
        return 0.5;

      case "ATTACKING_THIRD":
        return 0.2;

      default:
        return 0.5;
    }

  }

  protected calculatePlayerRiskTolerance(
    context: RiskContext
  ): number {

    const attributes =
      context.player.player.attributes;

    const flair =
      attributes.mental.flair;

    const bravery =
      attributes.mental.bravery;

    const decisions =
      attributes.mental.decisions;

    const pressure =
      attributes.hidden.pressure;

    const score =
      flair * 0.25 +
      bravery * 0.20 +
      decisions * 0.35 +
      pressure * 0.20;

    return score / 20;

  }

  protected calculateTacticalRisk(
    context: RiskContext
  ): number {

    /**
     * MVP:
     * ainda não temos o TacticalContext
     * completo.
     */

    return 0;

  }

  protected calculateMatchStateRisk(
    context: RiskContext
  ): number {

    /**
     * MVP:
     * ainda não temos Scoreline,
     * minuto e estado da partida
     * integrados ao DecisionContext.
     */

    return 0;

  }

  private calculatePassFailureProbability(
    context: RiskContext
  ): number {

    const decision =
      context.decision;

    const targetId =
      decision.targetId;

    if (!targetId) {
      return 1;
    }

    const teammate =
      context.decisionContext
        .awareness
        .teammates
        .get(targetId);

    if (!teammate) {
      return 1;
    }

    const certainty =
      teammate.certainty;

    const distance =
      context.player.position.distanceTo(
        teammate.estimatedPosition
      );

    const distanceRisk =
      Math.min(
        1,
        distance / 40
      );

    const uncertaintyRisk =
      1 -
      certainty;

    return Math.min(
      1,
      (
        distanceRisk * 0.6 +
        uncertaintyRisk * 0.4
      )
    );

  }

  private calculateShotFailureProbability(
    context: RiskContext
  ): number {

    const player =
      context.player;

    const composure =
      player.player.attributes
        .mental
        .composure;

    const decisions =
      player.player.attributes
        .mental
        .decisions;

    const score =
      composure * 0.5 +
      decisions * 0.5;

    return 1 -
      score / 20;

  }

}
import { FieldThird } from "../../../../domain";
import { DecisionType } from "../DecisionType";
import { RiskCalculator } from "./RiskCalculator";
import { RiskContext } from "./RiskContext";

/**
 * Default risk calculator.
 *
 * Design principles:
 * - Risk = failureProbability × consequenceSeverity × (1 − riskTolerance)
 * - Shots in the attacking third have LOW consequence severity — losing
 *   the ball near goal is acceptable. This prevents defensive conservatism
 *   from overwhelming shooting decisions.
 * - Passes are risky in proportion to their length and position uncertainty.
 * - Hold-ball has moderate base risk (not zero — opportunity cost exists).
 */
export class DefaultRiskCalculator extends RiskCalculator {

  protected calculateFailureProbability(context: RiskContext): number {
    switch (context.decision.type) {
      case DecisionType.PASS:
        return this.calculatePassFailureProbability(context);

      case DecisionType.SHOT:
        return this.calculateShotFailureProbability(context);

      case DecisionType.DRIBBLE:
        return 0.40;

      case DecisionType.TACKLE:
        return 0.35;

      case DecisionType.HOLD_BALL:
        // Holding the ball is "safe" in isolation but has opportunity cost.
        return 0.15;

      default:
        return 0.20;
    }
  }

  protected calculateConsequenceSeverity(context: RiskContext): number {
    switch (context.fieldThird) {
      case FieldThird.DEFENSIVE:
        // Losing the ball in own third = high severity regardless of action.
        return 0.90;

      case FieldThird.MIDDLE:
        return 0.45;

      case FieldThird.ATTACKING:
        // Losing possession near opponent goal is expected and recoverable.
        // Shots especially — the ball going out of play is fine.
        return context.decision.type === DecisionType.SHOT ? 0.05 : 0.18;
    }
  }

  protected calculatePlayerRiskTolerance(context: RiskContext): number {
    const attrs = context.player.player.attributes;

    const flair = attrs.mental.flair;
    const bravery = attrs.mental.bravery;
    const decisions = attrs.mental.decisions;
    const pressure = attrs.hidden.pressure;

    const score = flair * 0.25 + bravery * 0.20 + decisions * 0.35 + pressure * 0.20;

    // Normalise to [0, 1]. score max = 20, so divide by 20.
    return score / 20;
  }

  protected calculateTacticalRisk(_context: RiskContext): number {
    return 0; // Tactical context not yet fully integrated.
  }

  protected calculateMatchStateRisk(_context: RiskContext): number {
    return 0; // Scoreline/minute context not yet integrated.
  }

  // ────────────────────────────────────────────────────────────────────────

  private calculatePassFailureProbability(context: RiskContext): number {
    const targetId = context.decision.targetId;

    if (!targetId) return 0.80; // Unaddressed pass — very risky.

    const teammate = context.decisionContext.awareness.teammates.get(targetId);

    if (!teammate) {
      // Fallback: pass to a state-level teammate — moderate risk.
      return 0.35;
    }

    const certainty = teammate.certainty;
    const distance = context.player.position.distanceTo(teammate.estimatedPosition);

    // Longer passes are riskier; uncertainty about position adds risk.
    const distanceRisk = Math.min(1, distance / 40);
    const uncertaintyRisk = 1 - certainty;

    return Math.min(0.85, distanceRisk * 0.55 + uncertaintyRisk * 0.35);
  }

  private calculateShotFailureProbability(context: RiskContext): number {
    const attrs = context.player.player.attributes;

    const composure = attrs.mental.composure / 20;
    const decisions = attrs.mental.decisions / 20;
    const finishing = attrs.technical.finishing / 20;

    // Better finishers with high composure have lower shot failure probability.
    const skill = finishing * 0.50 + composure * 0.35 + decisions * 0.15;

    return Math.max(0.08, 1 - skill);
  }
}

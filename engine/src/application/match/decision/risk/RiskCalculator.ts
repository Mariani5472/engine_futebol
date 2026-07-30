import { RiskContext } from "./RiskContext";
import { RiskScore } from "./RiskScore";

export abstract class RiskCalculator {
  public calculate(context: RiskContext): RiskScore {
    const failureProbability = this.calculateFailureProbability(context);
    const consequenceSeverity = this.calculateConsequenceSeverity(context);
    const playerRiskTolerance = this.calculatePlayerRiskTolerance(context);
    const tacticalRisk = this.calculateTacticalRisk(context);
    const matchStateRisk = this.calculateMatchStateRisk(context);

    const personalityAdjustedRiskTolerance = Math.max(
      0,
      Math.min(
        1,
        playerRiskTolerance + this.normalizePersonalityModifier(
          context.personalityRiskToleranceModifier
        )
      )
    );

    return new RiskScore(
      failureProbability,
      consequenceSeverity,
      personalityAdjustedRiskTolerance,
      tacticalRisk,
      matchStateRisk,
      [
        {
          code: "FAILURE_PROBABILITY",
          value: failureProbability
        },
        {
          code: "CONSEQUENCE_SEVERITY",
          value: consequenceSeverity
        },
        {
          code: "PLAYER_RISK_TOLERANCE",
          value: playerRiskTolerance
        },
        {
          code: "PERSONALITY_RISK_TOLERANCE",
          value: personalityAdjustedRiskTolerance
        },
        {
          code: "TACTICAL_RISK",
          value: tacticalRisk
        },
        {
          code: "MATCH_STATE_RISK",
          value: matchStateRisk
        }
      ]
    );
  }

  protected abstract calculateFailureProbability(
    context: RiskContext
  ): number;

  protected abstract calculateConsequenceSeverity(
    context: RiskContext
  ): number;

  protected abstract calculatePlayerRiskTolerance(
    context: RiskContext
  ): number;

  protected abstract calculateTacticalRisk(
    context: RiskContext
  ): number;

  protected abstract calculateMatchStateRisk(
    context: RiskContext
  ): number;

  /**
   * PersonalityModifier currently emits a bounded modifier in [-10, 10].
   * Convert it into a conservative tolerance delta in [-0.25, 0.25].
   */
  private normalizePersonalityModifier(modifier: number): number {
    return Math.max(-0.25, Math.min(0.25, modifier / 40));
  }
}

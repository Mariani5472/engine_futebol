import { RiskContext } from "./RiskContext";
import { RiskScore } from "./RiskScore";
export abstract class RiskCalculator {
  public calculate(
    context: RiskContext
  ): RiskScore {
    const failureProbability =
      this.calculateFailureProbability(
        context
      );
    const consequenceSeverity =
      this.calculateConsequenceSeverity(
        context
      );
    const playerRiskTolerance =
      this.calculatePlayerRiskTolerance(
        context
      );
    const tacticalRisk =
      this.calculateTacticalRisk(
        context
      );
    const matchStateRisk =
      this.calculateMatchStateRisk(
        context
      );
    return new RiskScore(
      failureProbability,
      consequenceSeverity,
      playerRiskTolerance,
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
}
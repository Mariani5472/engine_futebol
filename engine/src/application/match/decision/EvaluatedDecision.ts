import { Decision } from "./Decision";
import { RiskScore } from "./risk/RiskScore";

export class EvaluatedDecision {
  constructor(
    public readonly decision: Decision,
    public readonly risk: RiskScore
  ) {}

  public get finalScore(): number {
    return (
      this.decision.utility -
      this.risk.total
    );
  }
}
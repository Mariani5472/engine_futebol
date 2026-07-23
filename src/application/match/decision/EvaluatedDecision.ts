import { Decision } from "./Decision";
import { RiskScore } from "./risk/RiskScore";
import { UtilityScore } from "./UtilityScore";
export class EvaluatedDecision {
  constructor(
    public readonly decision: Decision,
    public readonly utility: UtilityScore,
    public readonly risk: RiskScore,
    public readonly reason: string
  ) {}

  public get finalScore(): number {
    return (this.utility.total - this.risk.total);
  }

  public get isViable(): boolean {
    return this.finalScore > 0;
  }
}
export interface RiskReason {
  readonly code: string;
  readonly value: number;
}
export class RiskScore {
  constructor(
    public readonly failureProbability: number,
    public readonly consequenceSeverity: number,
    public readonly playerRiskTolerance: number,
    public readonly tacticalRisk: number,
    public readonly matchStateRisk: number,
    public readonly reasons: readonly RiskReason[]
  ) {}
  public get total(): number {
    const rawRisk =
      this.failureProbability *
      this.consequenceSeverity;
    const toleranceModifier =
      1 -
      this.playerRiskTolerance;
    const tacticalComponent =
      this.tacticalRisk;
    const matchStateComponent =
      this.matchStateRisk;
    return Math.max(
      0,
      Math.min(
        100,
        (
          rawRisk *
          toleranceModifier
        ) +
        tacticalComponent +
        matchStateComponent
      )
    );
  }
}
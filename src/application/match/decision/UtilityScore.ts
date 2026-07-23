import { UtilityReason } from "./UtilityReason";

export class UtilityScore {
  constructor(
    public readonly base: number,
    public readonly tactical: number,
    public readonly personality: number,
    public readonly reasons: readonly UtilityReason[]
  ) {}

  public get total(): number {
    return (this.base + this.tactical + this.personality);
  }
}
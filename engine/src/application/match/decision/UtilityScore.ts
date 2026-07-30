import { UtilityReason } from "./UtilityReason";

/**
 * Canonical component keys for decomposed utility scoring (Phase 7).
 * Evaluators should prefer UtilityScore.fromComponents() so debug output
 * can show Space / Pressure / Technique / Role / Risk / Fatigue / Body.
 */
export type UtilityComponentKey =
  | "SPACE"
  | "PRESSURE"
  | "TECHNIQUE"
  | "ROLE"
  | "RISK"
  | "FATIGUE"
  | "BODY"
  | "TACTICAL"
  | "PERSONALITY"
  | string;

export type UtilityComponents = Readonly<Partial<Record<UtilityComponentKey, number>>>;

export class UtilityScore {
  public readonly components: UtilityComponents;

  constructor(
    public readonly base: number,
    public readonly tactical: number = 0,
    public readonly personality: number = 0,
    public readonly risk: number = 0,
    public readonly reasons: UtilityReason[] = [],
    components?: UtilityComponents,
  ) {
    this.components = components ?? {
      TACTICAL: tactical,
      PERSONALITY: personality,
      RISK: -risk,
      BASE: base,
    };
  }

  public get total(): number {
    if (this.components && Object.keys(this.components).length > 0) {
      let sum = 0;
      for (const value of Object.values(this.components)) {
        if (typeof value === "number" && Number.isFinite(value)) {
          sum += value;
        }
      }
      // When components were synthesised from the legacy constructor, BASE already
      // includes the old total semantics via base+tactical+personality-risk only if
      // we fall back. Prefer explicit component sum when provided by fromComponents.
      if (Object.prototype.hasOwnProperty.call(this.components, "BASE") &&
          Object.keys(this.components).length <= 4) {
        return this.base + this.tactical + this.personality - this.risk;
      }
      return sum;
    }
    return this.base + this.tactical + this.personality - this.risk;
  }

  /**
   * Preferred factory: each component is independently debuggable.
   *
   * Example:
   *   UtilityScore.fromComponents({
   *     SPACE: 21, PRESSURE: -9, TECHNIQUE: 18, ROLE: 8, RISK: -4, BODY: 6,
   *   })
   */
  public static fromComponents(
    components: UtilityComponents,
    extraReasons: UtilityReason[] = [],
  ): UtilityScore {
    const safe: Record<string, number> = {};
    let total = 0;
    const reasons: UtilityReason[] = [...extraReasons];

    for (const [key, value] of Object.entries(components)) {
      const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
      safe[key] = v;
      total += v;
      if (!extraReasons.some((r) => r.code === key)) {
        reasons.push({ code: key, value: v });
      }
    }

    return new UtilityScore(total, 0, 0, 0, reasons, safe);
  }

  /** Human-readable breakdown for Decision Debug (Phase 8 precursor). */
  public formatDebug(label?: string): string {
    const header = label ? `${label}\n` : "";
    const lines = Object.entries(this.components)
      .filter(([, v]) => typeof v === "number")
      .map(([code, value]) => {
        const n = value as number;
        const sign = n >= 0 ? " " : "";
        return `  ${code.padEnd(16, ".")}${sign}${n.toFixed(1)}`;
      });
    lines.push(`  ${"TOTAL".padEnd(16, ".")}${this.total.toFixed(1)}`);
    return header + lines.join("\n");
  }
}

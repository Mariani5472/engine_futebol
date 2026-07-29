import { DecisionType } from "./DecisionType";
import { UtilityReason } from "./UtilityReason";
import { UtilityComponents } from "./UtilityScore";
import { Decision } from "./Decision";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TacticalObjective } from "./TacticalObjective";

export interface DecisionDebugEntry {
  readonly tick: number;
  readonly matchSecond: number;
  readonly playerId: string;
  readonly playerName: string;
  readonly decisionType: DecisionType | string;
  readonly utility: number;
  readonly objective: TacticalObjective;
  readonly targetId?: string;
  readonly reasons: readonly UtilityReason[];
  readonly components?: UtilityComponents;
  readonly hasBall: boolean;
  readonly selected:boolean;
  readonly rejectionReasons:readonly string[];
}

export interface DecisionDebugOptions {
  /** When true, formatEntry output is also written via `logger`. Default false. */
  readonly logToConsole?: boolean;
  /** Max entries retained in memory. Default 500. */
  readonly maxEntries?: number;
  /** Optional sink (defaults to console.log when logToConsole is true). */
  readonly logger?: (message: string) => void;
}

/**
 * Collects and formats decision breakdowns for debugging (Phase 8).
 *
 * Example output:
 *
 *   Player 7 (striker-1)
 *   Decision: PASS → teammate-3
 *   Utility: 74.2
 *   Reasons:
 *     SPACE............ +21.0
 *     PRESSURE.........  -9.0
 *     TECHNIQUE........ +18.0
 *     ROLE.............  +8.0
 *     RISK.............  -4.0
 */
export class DecisionDebug {
  private enabled = false;
  private readonly entries: DecisionDebugEntry[] = [];
  private readonly maxEntries: number;
  private readonly logToConsole: boolean;
  private readonly logger: (message: string) => void;

  constructor(options: DecisionDebugOptions = {}) {
    this.maxEntries = options.maxEntries ?? 500;
    this.logToConsole = options.logToConsole ?? false;
    this.logger = options.logger ?? ((msg) => console.log(msg));
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public clear(): void {
    this.entries.length = 0;
  }

  public getEntries(): readonly DecisionDebugEntry[] {
    return this.entries;
  }

  /**
   * Record a chosen decision. No-op when disabled.
   */
  public record(
    player: PlayerMatchState,
    decision: Decision,
    meta: { tick: number; matchSecond: number; selected?:boolean; rejectionReasons?:readonly string[] },
  ): void {
    if (!this.enabled) return;

    const reasons = this.resolveReasons(decision);
    const entry: DecisionDebugEntry = {
      tick: meta.tick,
      matchSecond: meta.matchSecond,
      playerId: player.player.id,
      playerName: (player.player as { name?: string }).name ?? player.player.id,
      decisionType: decision.type,
      utility: decision.utility,
      objective: decision.objective,
      targetId: decision.targetId,
      reasons,
      components: decision.components,
      hasBall: player.hasBall,
      selected:meta.selected??true,
      rejectionReasons:meta.rejectionReasons??[],
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    if (this.logToConsole) {
      this.logger(this.formatEntry(entry));
    }
  }

  public formatEntry(entry: DecisionDebugEntry): string {
    const typeName =
      typeof entry.decisionType === "string"
        ? entry.decisionType
        : DecisionType[entry.decisionType as DecisionType] ??
          String(entry.decisionType);

    const targetSuffix = entry.targetId ? ` → ${entry.targetId}` : "";
    const lines: string[] = [
      `Player ${entry.playerName} (${entry.playerId})`,
      `Decision: ${typeName}${targetSuffix}`,
      `Objective: ${entry.objective}`,
      `Utility: ${entry.utility.toFixed(1)}`,
    ];

    if (entry.reasons.length > 0) {
      lines.push("Reasons:");
      for (const reason of entry.reasons) {
        lines.push(`  ${this.formatReason(reason.code, reason.value)}`);
      }
    } else if (entry.components && Object.keys(entry.components).length > 0) {
      lines.push("Reasons:");
      for (const [code, value] of Object.entries(entry.components)) {
        if (typeof value === "number") {
          lines.push(`  ${this.formatReason(code, value)}`);
        }
      }
    }

    return lines.join("\n");
  }

  /** Format every retained entry, separated by blank lines. */
  public formatAll(): string {
    return this.entries.map((e) => this.formatEntry(e)).join("\n\n");
  }

  /** Entries for a single player. */
  public forPlayer(playerId: string): readonly DecisionDebugEntry[] {
    return this.entries.filter((e) => e.playerId === playerId);
  }

  private resolveReasons(decision: Decision): readonly UtilityReason[] {
    if (decision.reasons && decision.reasons.length > 0) {
      return decision.reasons;
    }
    if (decision.components) {
      return Object.entries(decision.components)
        .filter(([, v]) => typeof v === "number")
        .map(([code, value]) => ({ code, value: value as number }));
    }
    return [];
  }

  private formatReason(code: string, value: number): string {
    const padded = code.padEnd(16, ".");
    const sign = value >= 0 ? "+" : "";
    return `${padded} ${sign}${value.toFixed(1)}`;
  }
}

/** Shared sink — enable from tests or MatchEngine config. */
export const globalDecisionDebug = new DecisionDebug();

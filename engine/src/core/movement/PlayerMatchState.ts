import { DecisionType } from "../../application/match/decision/DecisionType";
import type { ActionExecution } from "../../application/match/action/ActionExecution";
import type { PipelineExecution } from "../../application/match/action/PipelineExecution";
import { Player, PlayerRole } from "../../domain";
import { Vector2 } from "../geometry/Vector2";
import type { PlayerIntent } from "../../application/match/tactical/intelligence/TacticalIntelligenceTypes";

export class PlayerMatchState {
  /** Scenario-only constraints; normal matches leave both false. */
  public scenarioMovementFrozen = false;
  public scenarioDecisionDisabled = false;
  /** Fixed scenario target consumed by locomotion even if tactical systems update their own target. */
  public scenarioTargetPosition: Vector2 | null = null;
  public scenarioTrackBall = false;
  public tacticalAnchorPosition: Vector2;

  public activeAction?: ActionExecution;
  /** Multi-step play sequence that owns activeAction while running. */
  public activePipeline?: PipelineExecution;
  /** Absolute match time when this player may make another decision. */
  public nextDecisionAt = 0;
  /** Absolute match time when this player may attempt another tackle/foul. */
  public tackleLockUntil = 0;
  /** Prevents the same player retrying a failed first touch every simulation tick. */
  public controlAttemptLockUntil = 0;
  /** Hard first-touch window: no new on-ball action may start before this. */
  public possessionControlUntil = 0;
  /** Brief shielding window after a physical reception. */
  public possessionProtectedUntil = 0;
  /** Start of the currently accepted running corridor. */
  public runCorridorOrigin: Vector2;
  /** Counts material target changes; useful for locomotion diagnostics. */
  public acceptedTargetChanges = 0;
  /** Temporary collective duty assigned by the coordination layer. */
  public tacticalResponsibility: string | null = null;
  public responsibilityUntil = 0;
  public occupiedChannel: "LEFT" | "CENTRE" | "RIGHT" | null = null;
  public goalkeeperState: "POSITIONING" | "SET" | "CLOSING_ANGLE" | "RUSHING_OUT" | "DIVING" | "SMOTHERING" | "PARRYING" | "CATCHING" | "RECOVERING" | "DISTRIBUTING" = "POSITIONING";
  public goalkeeperReactionUntil = 0;
  public goalkeeperInterceptionTarget: Vector2 | null = null;
  public goalkeeperInterceptionHeight: number | null = null;
  public goalkeeperCommittedAt = 0;
  public goalkeeperStateUntil = 0;
  public goalkeeperDiveOrigin: Vector2 | null = null;
  public activeCarry: {
    readonly origin: Vector2;
    readonly destination: Vector2;
    readonly desiredSpeed: number;
    readonly controlMode: "CLOSE" | "NORMAL" | "SPRINT";
    readonly purpose: "PROGRESS" | "ESCAPE_PRESSURE" | "CREATE_ANGLE" | "ATTACK_SPACE" | "PROTECT_POSSESSION";
    readonly startedAt: number;
  } | null = null;
  /** Stable tactical intention. It survives decision ticks until a causal cancel condition fires. */
  public intent: PlayerIntent | null = null;
  /** Short-lived pass-and-move relationship used to create organic one-twos. */
  public oneTwoPartnerId: string | null = null;
  public oneTwoReturnTargetId: string | null = null;
  public oneTwoAvailableUntil = 0;
  public oneTwoRunTarget: Vector2 | null = null;
  /** Two-stage collective combination: origin -> support -> runner. */
  public thirdManOriginId: string | null = null;
  public thirdManNextTargetId: string | null = null;
  public thirdManAvailableUntil = 0;

  constructor(
    public readonly player: Player,
    public position: Vector2,
    public velocity: Vector2,
    public stamina: number,
    public fatigue: number,
    public hasBall: boolean,
    public currentRole: PlayerRole,
    public targetPosition: Vector2,
    public facingDirection: Vector2,
    public actionLockUntil: number,
    public recoveryUntil: number,
    public bodyState: "STANDING" | "BALANCED" | "LEANING" | "FALLING" | "GROUND",
    public bodyOrientation: number,
    public balance: number,
    public stability: number,
    public lastActionType?: DecisionType,
  ) {
    this.tacticalAnchorPosition = targetPosition;
    this.runCorridorOrigin = position;
  }

  public setTarget(position: Vector2): void {
    // Tactical systems update every tick. Ignore sub-metre jitter so the
    // locomotion layer follows a stable intention rather than chasing noise.
    if (this.targetPosition.distanceTo(position) < 1) return;
    this.runCorridorOrigin = this.position;
    this.targetPosition = position;
    this.acceptedTargetChanges++;
  }

  public isActionBusy(): boolean {
    if (this.activePipeline?.isBusy()) return true;
    return this.activeAction?.isBusy() ?? false;
  }
}

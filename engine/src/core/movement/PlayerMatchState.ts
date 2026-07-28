import { DecisionType } from "../../application/match/decision/DecisionType";
import type { ActionExecution } from "../../application/match/action/ActionExecution";
import type { PipelineExecution } from "../../application/match/action/PipelineExecution";
import { Player, PlayerRole } from "../../domain";
import { Vector2 } from "../geometry/Vector2";

export class PlayerMatchState {
  public tacticalAnchorPosition: Vector2;

  public activeAction?: ActionExecution;
  /** Multi-step play sequence that owns activeAction while running. */
  public activePipeline?: PipelineExecution;
  /** Absolute match time when this player may make another decision. */
  public nextDecisionAt = 0;
  /** Absolute match time when this player may attempt another tackle/foul. */
  public tackleLockUntil = 0;

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
  }

  public setTarget(position: Vector2): void {
    this.targetPosition = position;
  }

  public isActionBusy(): boolean {
    if (this.activePipeline?.isBusy()) return true;
    return this.activeAction?.isBusy() ?? false;
  }
}

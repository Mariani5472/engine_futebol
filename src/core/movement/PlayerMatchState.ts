import { DecisionType } from "../../application/match/decision/DecisionType";
import { Player, PlayerRole } from "../../domain";
import { Vector2 } from "../geometry/Vector2";

export class PlayerMatchState {

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
  ) {}

  public setTarget(position: Vector2): void {
    this.targetPosition = position;
  }
}
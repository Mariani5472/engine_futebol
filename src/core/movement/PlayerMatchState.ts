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
    public facingDirection: Vector2
  ) {}

  public setTarget(position: Vector2): void {
    this.targetPosition = position;
  }
}
import { Vector2 } from "../geometry/Vector2";
import { PlayerMatchState } from "./PlayerMatchState";
export enum BallState {
  CONTROLLED,
  FREE,
  IN_FLIGHT,
  DEFLECTED
}
export class BallMatchState {
  constructor(
    public position: Vector2,
    public velocity: Vector2,
    public owner: PlayerMatchState | null,
    public state: BallState,
    public height: number
  ) {}
}
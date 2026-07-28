import { Vector2 } from "../geometry/Vector2";

export class Velocity {

  constructor(
    public readonly direction: Vector2,
    public readonly speed: number

  ) {}

}
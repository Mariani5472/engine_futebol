import { Vector2 } from "./Vector2";

export class Angle {

  static between(
    from: Vector2,
    to: Vector2
  ): number {

    return Math.atan2(
      to.y - from.y,
      to.x - from.x
    );

  }

  static difference(
    a: number,
    b: number
  ): number {

    let diff = b - a;

    while (diff > Math.PI)
      diff -= Math.PI * 2;

    while (diff < -Math.PI)
      diff += Math.PI * 2;

    return diff;

  }

}
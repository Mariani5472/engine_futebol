import { Vector2 } from "./Vector2";

export class Distance {

  static between(
    a: Vector2,
    b: Vector2
  ): number {

    return a.distanceTo(b);

  }

  static squared(
    a: Vector2,
    b: Vector2
  ): number {

    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return dx * dx + dy * dy;

  }

}
import { Vector2 } from "../../../core/geometry/Vector2";

export class NoiseResult {
  constructor(
    public readonly position: Vector2,
    public readonly angleOffset: number,
    public readonly spatialError: number
  ) {}
}
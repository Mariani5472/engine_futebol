import { Vector2 } from "../../../../core/geometry/Vector2";
export class BallMemory {
  constructor(
    public estimatedPosition: Vector2,
    public estimatedVelocity: Vector2,
    public certainty: number,
    public lastSeenTick: number,
    public lastUpdatedTick: number,
    public spatialError: number
  ) {}
  public static create(): BallMemory {
    return new BallMemory(
      Vector2.zero(),
      Vector2.zero(),
      0,
      0,
      0,
      0
    );
  }
}
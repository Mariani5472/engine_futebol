import { Vector2 } from "../../../../core/geometry/Vector2";

export class PlayerMemory {

  constructor(
    public readonly playerId: string,
    public estimatedPosition: Vector2,
    public estimatedVelocity: Vector2,
    public certainty: number,
    public lastSeenTick: number,
    public lastUpdatedTick: number,
    public spatialError: number
  ) {}

  public static create(
    playerId: string,
    position: Vector2,
    tick: number
  ): PlayerMemory {

    return new PlayerMemory(
      playerId,
      position,
      Vector2.zero(),
      1,
      tick,
      tick,
      0
    );
  }

  public isReliable(): boolean {
    return this.certainty >= 0.25;
  }

  public shouldForget(): boolean {
    return (
      this.certainty <= 0.05 ||
      this.spatialError >= 30
    );
  }
}
import { Vector2 } from "../geometry/Vector2";
import { PitchGrid } from "./PitchGrid";
import { PitchZone } from "./PitchZone";
export class PositionZoneResolver {
  constructor(
    private readonly pitchGrid: PitchGrid
  ) {}
  public resolve(
    position: Vector2
  ): PitchZone {
    const zone =
      this.pitchGrid.getZoneAt(
        position
      );
    if (!zone) {
      throw new Error(
        `Position ${position.x}, ${position.y} is outside the pitch`
      );
    }
    return zone;
  }
}
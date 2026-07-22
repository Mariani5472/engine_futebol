import { Vector2 } from "./Vector2";
import { PitchGrid } from "../pitch/PitchGrid";
import { PitchZone } from "../pitch/PitchZone";

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
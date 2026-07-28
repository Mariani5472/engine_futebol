import { PitchZoneId } from "../../domain";
import { Rectangle } from "../geometry/Rectangle";

export class PitchZone {

  constructor(
    public readonly id: PitchZoneId,
    public readonly row: number,
    public readonly column: number,
    public readonly rectangle: Rectangle
  ) {}

}
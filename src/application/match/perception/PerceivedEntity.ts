import { Vector2 } from "../../../core/geometry/Vector2";
import { PitchZoneId } from "../../../domain";
import { Visibility } from "./Visibility";
export interface PerceivedEntity {
  entityId: string;
  position: Vector2;
  distance: number;
  angle: number;
  zone: PitchZoneId;
  visibility: Visibility;
}
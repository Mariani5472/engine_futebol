import { Vector2 } from "../../../../core/geometry/Vector2";
export interface BallKnowledge {
  position: Vector2;
  certainty: number;
  lastSeenTick: number;
  estimatedVelocity: Vector2;
}
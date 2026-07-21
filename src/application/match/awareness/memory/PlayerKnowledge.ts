import { Vector2 } from "../../../../core/geometry/Vector2";

export interface PlayerKnowledge {
  playerId: string;
  estimatedPosition: Vector2;
  certainty: number;
  lastSeenTick: number;
}
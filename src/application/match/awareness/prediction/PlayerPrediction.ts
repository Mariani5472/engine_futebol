import { Vector2 } from "../../../../core/geometry/Vector2";
export class PlayerPrediction {
  constructor(
    public readonly playerId: string,
    public predictedPosition: Vector2,
    public predictedDirection: Vector2,
    public confidence: number
  ) {}
}
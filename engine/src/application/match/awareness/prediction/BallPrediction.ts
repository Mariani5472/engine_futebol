import { Vector2 } from "../../../../core/geometry/Vector2";

export class BallPrediction {
  constructor(
    public predictedPosition: Vector2,
    public predictedVelocity: Vector2,
    public confidence: number
  ) {}
}
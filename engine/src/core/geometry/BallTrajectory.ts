import { BallTrajectory } from "../../domain";
import { Vector2 } from "./Vector2";

export class BallTrajectoryFactory {
  static create(
    origin: Vector2,
    target: Vector2,
    speed: number
  ): BallTrajectory {
    return {
      origin,
      target,
      speed,
      direction: target.subtract(origin).normalize()
    };
  }
}
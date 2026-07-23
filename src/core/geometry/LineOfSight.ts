import { Vector2 } from "./Vector2";
import { Segment } from "./Segment";
import { Intersection } from "./Intersection";
import { CircleObstacle } from "../../domain";
export class LineOfSight {
  public static hasVision(
    from: Vector2,
    to: Vector2,
    obstacles: readonly CircleObstacle[]
  ): boolean {
    const segment =
      new Segment(
        from,
        to
      );
    return !obstacles.some(obstacle => {
      const position = new Vector2(
        obstacle.position.x, obstacle.position.y
      );
      Intersection.segmentCircle(
        segment,
        position,
        obstacle.radius
      );
    });
  }
}
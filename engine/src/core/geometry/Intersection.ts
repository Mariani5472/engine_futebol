import { Segment } from "./Segment";
import { Vector2 } from "./Vector2";

export class Intersection {

  static segmentCircle(
    segment: Segment,
    center: Vector2,
    radius: number
  ): boolean {

    const ab = segment.end.subtract(segment.start);
    const ac = center.subtract(segment.start);

    const projection = ac.dot(ab) / ab.dot(ab);
    const t = Math.max(0, Math.min(1, projection));

    const closest = segment.start.add(ab.multiply(t));

    return (closest.distanceTo(center) <= radius);

  }

}
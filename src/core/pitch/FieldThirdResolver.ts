import { Vector2 } from "../geometry/Vector2";
import { FieldThird } from "../../domain";
export class FieldThirdResolver {
  constructor(
    private readonly pitchLength: number
  ) {}
  public resolve(
    position: Vector2,
    attackingDirection: 1 | -1
  ): FieldThird {
    const normalizedX =
      position.x /
      this.pitchLength;
    const attackingX =
      attackingDirection === 1
        ? normalizedX
        : 1 - normalizedX;
    if (
      attackingX <
      1 / 3
    ) {
      return FieldThird.DEFENSIVE;
    }
    if (
      attackingX <
      2 / 3
    ) {
      return FieldThird.MIDDLE;
    }
    return FieldThird.ATTACKING;
  }
}
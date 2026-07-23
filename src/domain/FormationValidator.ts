import {
  TacticalPosition,
  isTacticalPosition,
} from "./TacticalPositions";
export interface FormationValidationResult {
  readonly valid:
  boolean;
  readonly errors:
  readonly string[];
}
export class FormationValidator {
  public static validate(
    positions:
      readonly TacticalPosition[]
  ): FormationValidationResult {
    const errors:
      string[] = [];
    if (
      positions.length !== 11
    ) {
      errors.push(
        "A formation must contain exactly 11 players."
      );
    }
    const goalkeeperCount =
      positions.filter(
        position =>
          position === "GK"
      ).length;
    if (
      goalkeeperCount !== 1
    ) {
      errors.push(
        "A formation must contain exactly one goalkeeper."
      );
    }
    const invalidPositions =
      positions.filter(
        position =>
          !isTacticalPosition(
            position
          )
      );
    if (
      invalidPositions.length > 0
    ) {
      errors.push(
        `Invalid tactical positions: ` +
        `${invalidPositions.join(", ")}`
      );
    }
    const duplicates =
      this.findDuplicatePositions(
        positions
      );
    for (
      const duplicate
      of duplicates
    ) {
      errors.push(
        `Tactical position ${duplicate} ` +
        "cannot be occupied by more than one player."
      );
    }
    return {
      valid:
        errors.length === 0,
      errors,
    };
  }
  public static assertValid(
    positions:
      readonly TacticalPosition[]
  ): void {
    const result =
      this.validate(
        positions
      );
    if (
      !result.valid
    ) {
      throw new Error(
        result.errors.join(
          " "
        )
      );
    }
  }
  private static findDuplicatePositions(
    positions:
      readonly TacticalPosition[]
  ):
    readonly TacticalPosition[] {
    const counts =
      new Map<
        TacticalPosition,
        number
      >();
    for (
      const position
      of positions
    ) {
      counts.set(
        position,
        (
          counts.get(
            position
          ) ??
          0
        ) + 1
      );
    }
    return [
      ...counts.entries(),
    ]
      .filter(
        ([
          ,
          count,
        ]) =>
          count > 1
      )
      .map(
        ([
          position,
        ]) =>
          position
      );
  }
}
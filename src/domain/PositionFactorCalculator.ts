import {
  TacticalPosition,
  areOppositeSides,
  areSamePositionFamily,
  getPositionSide,
} from "./TacticalPositions";
export class PositionFactorCalculator {
  public static calculate(
    naturalPosition: TacticalPosition,
    assignedPosition: TacticalPosition
  ): number {
    if (
      naturalPosition === assignedPosition
    ) {
      return 1.00;
    }
    if (
      areSamePositionFamily(
        naturalPosition,
        assignedPosition
      )
    ) {
      return 0.90;
    }
    if (
      areOppositeSides(
        naturalPosition,
        assignedPosition
      )
    ) {
      return 0.55;
    }
    const naturalSide =
      getPositionSide(
        naturalPosition
      );
    const assignedSide =
      getPositionSide(
        assignedPosition
      );
    if (
      naturalSide === "CENTRE" ||
      assignedSide === "CENTRE"
    ) {
      return 0.65;
    }
    return 0.70;
  }
  public static calculateFromPositions(
    naturalPositions: readonly TacticalPosition[],
    assignedPosition: TacticalPosition
  ): number {
    if (
      naturalPositions.length === 0
    ) {
      return 0.55;
    }
    return Math.max(
      ...naturalPositions.map(
        naturalPosition =>
          this.calculate(
            naturalPosition,
            assignedPosition
          )
      )
    );
  }
}
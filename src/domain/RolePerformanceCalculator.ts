import {
  PlayerBase,
} from "./PlayerBase";
import {
  TacticalPosition,
} from "./TacticalPositions";
import {
  RoleDefinition,
} from "./RoleAttributeMapping";
import {
  RoleSuitabilityCalculator,
} from "./RoleSuitabilityCalculator";
import {
  PositionFactorCalculator,
} from "./PositionFactorCalculator";
import {
  PlayerMatchState,
} from "./PlayerMatchState";
export interface RolePerformanceResult {
  readonly roleScore:
  number;
  readonly roleScorePercentage:
  number;
  readonly positionFactor:
  number;
  readonly conditionFactor:
  number;
  readonly effectivePerformance:
  number;
  readonly effectivePerformancePercentage:
  number;
}
export class RolePerformanceCalculator {
  public static calculate(
    player: PlayerBase,
    matchState: PlayerMatchState,
    role: RoleDefinition,
    naturalPositions: readonly TacticalPosition[]
  ): RolePerformanceResult {
    const roleResult =
      RoleSuitabilityCalculator.calculate(
        player,
        role
      );
    const positionFactor =
      PositionFactorCalculator.calculateFromPositions(
        naturalPositions,
        matchState.tacticalPosition
      );
    const conditionFactor =
      this.calculateConditionFactor(
        matchState
      );
    const effectivePerformance =
      roleResult.rawScore *
      positionFactor *
      conditionFactor;
    return Object.freeze({
      roleScore:
        roleResult.rawScore,
      roleScorePercentage:
        roleResult.percentage,
      positionFactor,
      conditionFactor,
      effectivePerformance:
        Number(
          effectivePerformance.toFixed(
            4
          )
        ),
      effectivePerformancePercentage:
        Number(
          (
            effectivePerformance /
            20 *
            100
          ).toFixed(
            2
          )
        ),
    });
  }
  private static calculateConditionFactor(
    matchState: PlayerMatchState
  ): number {
    const condition =
      matchState.condition /
      100;
    const fitness =
      matchState.fitness /
      100;
    const stamina =
      matchState.currentStamina /
      100;
    const fatigue =
      1 -
      (
        matchState.fatigue /
        100
      );
    return Math.max(
      0,
      Math.min(
        1,
        (
          condition * 0.30 +
          fitness * 0.25 +
          stamina * 0.25 +
          fatigue * 0.20
        )
      )
    );
  }
}
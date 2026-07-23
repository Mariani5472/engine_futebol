import {
  AttributeValue,
} from "./common";
import {
  PlayerBase,
} from "./PlayerBase";
import {
  TacticalPosition,
} from "./TacticalPositions";
import {
  PositionSuitability,
  getSuitabilityMultiplier,
} from "./PositionSuitability";
export interface PositionEfficiencyResult {
  readonly position: TacticalPosition;
  readonly suitability: PositionSuitability;
  readonly multiplier: number;
  readonly percentage: number;
}
export class PositionSuitabilityCalculator {
  public static calculate(
    player: PlayerBase,
    position: TacticalPosition
  ): PositionEfficiencyResult {
    const suitability = player.getPositionSuitability(position);
    const multiplier = getSuitabilityMultiplier(suitability);
    return Object.freeze({
      position,
      suitability,
      multiplier,
      percentage: Math.round(multiplier * 100),
    });
  }
  public static calculateMultiplier(
    player: PlayerBase,
    position: TacticalPosition
  ): number {
    return this.calculate(player, position).multiplier;
  }
  public static calculatePercentage(
    player: PlayerBase,
    position: TacticalPosition
  ): number {
    return this.calculate(
      player,
      position
    ).percentage;
  }
}
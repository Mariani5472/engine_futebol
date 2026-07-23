import {
  AttributeRange,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
} from "./AttributeRange";
import {
  AttributeValue,
} from "./common";
import {
  TacticalPosition,
} from "./TacticalPositions";
export type PositionSuitabilityLevel =
  | "NATURAL"
  | "ACCOMPLISHED"
  | "COMPETENT"
  | "UNCONVINCING"
  | "AWKWARD";
export interface PositionSuitability {
  readonly position: TacticalPosition;
  readonly rating: AttributeValue;
  readonly level: PositionSuitabilityLevel;
}
export const POSITION_SUITABILITY_MULTIPLIER: Readonly<
  Record<PositionSuitabilityLevel, number>
> = {
  NATURAL: 1.00,
  ACCOMPLISHED: 0.90,
  COMPETENT: 0.80,
  UNCONVINCING: 0.60,
  AWKWARD: 0.35,
};
export function getSuitabilityLevel(rating: number): PositionSuitabilityLevel {
  const normalized = AttributeRange.normalize(rating);
  if (normalized >= 18) {
    return "NATURAL";
  }
  if (normalized >= 15) {
    return "ACCOMPLISHED";
  }
  if (normalized >= 11) {
    return "COMPETENT";
  }
  if (normalized >= 6) {
    return "UNCONVINCING";
  }
  return "AWKWARD";
}
export function createPositionSuitability(
  position: TacticalPosition,
  rating: number
): PositionSuitability {
  const normalized = AttributeRange.normalize(rating);
  return Object.freeze({
    position,
    rating: normalized,
    level: getSuitabilityLevel(normalized),
  });
}
export function getSuitabilityMultiplier(
  suitability: PositionSuitability
): number {
  return POSITION_SUITABILITY_MULTIPLIER[suitability.level];
}
export function createDefaultSuitabilityMap(): Readonly<
  Partial<Record<TacticalPosition, PositionSuitability>>
> {
  return Object.freeze({});
}
export function getDefaultPositionRating(): AttributeValue {
  return AttributeRange.create(ATTRIBUTE_MIN);
}
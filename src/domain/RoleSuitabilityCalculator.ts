import {
  PlayerBase,
} from "./PlayerBase";
import {
  RoleAttribute,
  RoleDefinition,
} from "./RoleAttributeMapping";
export const ROLE_KEY_WEIGHT =
  3.0;
export const ROLE_PREFERRED_WEIGHT =
  1.5;
export const ROLE_UNNECESSARY_WEIGHT =
  0.5;
export interface RoleScoreResult {
  readonly role:
  RoleDefinition["role"];
  readonly phase:
  RoleDefinition["phase"];
  readonly rawScore:
  number;
  readonly percentage:
  number;
  readonly keyScore:
  number;
  readonly preferredScore:
  number;
  readonly unnecessaryScore:
  number;
}
export class RoleSuitabilityCalculator {
  public static calculateRoleScore(
    player: PlayerBase,
    role: RoleDefinition
  ): number {
    const result =
      this.calculate(
        player,
        role
      );
    return result.rawScore;
  }
  public static calculate(
    player: PlayerBase,
    role: RoleDefinition
  ): RoleScoreResult {
    const keyScore =
      this.calculateAverage(
        player,
        role.attributes.key
      );
    const preferredScore =
      this.calculateAverage(
        player,
        role.attributes.preferred
      );
    const unnecessaryScore =
      this.calculateAverage(
        player,
        role.attributes.unnecessary
      );
    const keyWeight =
      role.attributes.key.length *
      ROLE_KEY_WEIGHT;
    const preferredWeight =
      role.attributes.preferred.length *
      ROLE_PREFERRED_WEIGHT;
    const unnecessaryWeight =
      role.attributes.unnecessary.length *
      ROLE_UNNECESSARY_WEIGHT;
    const totalWeight =
      keyWeight +
      preferredWeight +
      unnecessaryWeight;
    if (
      totalWeight === 0
    ) {
      throw new Error(
        `Role ${role.role} has no attributes configured.`
      );
    }
    const rawScore =
      (
        keyScore * keyWeight +
        preferredScore * preferredWeight +
        unnecessaryScore * unnecessaryWeight
      ) /
      totalWeight;
    return Object.freeze({
      role:
        role.role,
      phase:
        role.phase,
      rawScore:
        Number(
          rawScore.toFixed(
            4
          )
        ),
      percentage:
        Number(
          (
            rawScore /
            20 *
            100
          ).toFixed(
            2
          )
        ),
      keyScore:
        Number(
          keyScore.toFixed(
            4
          )
        ),
      preferredScore:
        Number(
          preferredScore.toFixed(
            4
          )
        ),
      unnecessaryScore:
        Number(
          unnecessaryScore.toFixed(
            4
          )
        ),
    });
  }
  private static calculateAverage(
    player: PlayerBase,
    attributes: readonly RoleAttribute[]
  ): number {
    if (
      attributes.length === 0
    ) {
      return 0;
    }
    const total =
      attributes.reduce(
        (
          sum,
          attribute
        ) => {
          return sum +
            Number(
              player.getAttribute(
                attribute
              )
            );
        },
        0
      );
    return (
      total /
      attributes.length
    );
  }
}
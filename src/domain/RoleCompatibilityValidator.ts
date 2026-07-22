import {
  PlayerPosition,
  PlayerRole,
} from "./PlayerBase";

export class RoleCompatibilityValidator {

  private static readonly COMPATIBILITY:
    Readonly<
      Record<
        PlayerPosition,
        readonly PlayerRole[]
      >
    > = {

      GK: [
        "GOALKEEPER",
      ],

      DC: [
        "CENTRE_BACK",
      ],

      DL: [
        "FULL_BACK",
      ],

      DR: [
        "FULL_BACK",
      ],

      WBL: [
        "WING_BACK",
      ],

      WBR: [
        "WING_BACK",
      ],

      DM: [
        "DEFENSIVE_MIDFIELDER",
      ],

      MC: [
        "CENTRAL_MIDFIELDER",
      ],

      ML: [
        "WIDE_MIDFIELDER",
      ],

      MR: [
        "WIDE_MIDFIELDER",
      ],

      AMC: [
        "ATTACKING_MIDFIELDER",
      ],

      WL: [
        "WINGER",
      ],

      WR: [
        "WINGER",
      ],

      ST: [
        "STRIKER",
      ],
    };

  public static isCompatible(
    position: PlayerPosition,
    role: PlayerRole
  ): boolean {

    return this.COMPATIBILITY[
      position
    ].includes(
      role
    );
  }

  public static assertCompatible(
    position: PlayerPosition,
    role: PlayerRole
  ): void {

    if (
      !this.isCompatible(
        position,
        role
      )
    ) {
      throw new Error(
        `Role ${role} is not compatible ` +
        `with position ${position}.`
      );
    }
  }

  public static getCompatibleRoles(
    position: PlayerPosition
  ): readonly PlayerRole[] {

    return this.COMPATIBILITY[
      position
    ];
  }
}
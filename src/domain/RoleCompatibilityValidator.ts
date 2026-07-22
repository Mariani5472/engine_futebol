import {
  PlayerRole,
} from "./PlayerBase";

import {
  TacticalPosition,
} from "./TacticalPositions";

export class RoleCompatibilityValidator {

  private static readonly COMPATIBILITY:
    Readonly<
      Record<
        TacticalPosition,
        readonly PlayerRole[]
      >
    > = {

      GK: [
        "GOALKEEPER",
      ],

      DR: [
        "FULL_BACK",
      ],

      DCR: [
        "CENTRE_BACK",
      ],

      DCC: [
        "CENTRE_BACK",
      ],

      DCE: [
        "CENTRE_BACK",
      ],

      DL: [
        "FULL_BACK",
      ],

      WBR: [
        "WING_BACK",
      ],

      DMR: [
        "DEFENSIVE_MIDFIELDER",
      ],

      DMC: [
        "DEFENSIVE_MIDFIELDER",
      ],

      DME: [
        "DEFENSIVE_MIDFIELDER",
      ],

      WBL: [
        "WING_BACK",
      ],

      MR: [
        "WIDE_MIDFIELDER",
      ],

      MCR: [
        "CENTRAL_MIDFIELDER",
      ],

      MCC: [
        "CENTRAL_MIDFIELDER",
      ],

      MCL: [
        "CENTRAL_MIDFIELDER",
      ],

      ML: [
        "WIDE_MIDFIELDER",
      ],

      WR: [
        "WINGER",
        "ATTACKING_MIDFIELDER",
      ],

      AMR: [
        "ATTACKING_MIDFIELDER",
        "WINGER",
      ],

      AMC: [
        "ATTACKING_MIDFIELDER",
      ],

      AML: [
        "ATTACKING_MIDFIELDER",
        "WINGER",
      ],

      WL: [
        "WINGER",
        "ATTACKING_MIDFIELDER",
      ],

      STR: [
        "STRIKER",
      ],

      STC: [
        "STRIKER",
      ],

      STL: [
        "STRIKER",
      ],
    };

  public static isCompatible(
    position: TacticalPosition,
    role: PlayerRole
  ): boolean {

    return this.COMPATIBILITY[
      position
    ].includes(
      role
    );
  }

  public static assertCompatible(
    position: TacticalPosition,
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
    position: TacticalPosition
  ):
    readonly PlayerRole[] {

    return this.COMPATIBILITY[
      position
    ];
  }
}
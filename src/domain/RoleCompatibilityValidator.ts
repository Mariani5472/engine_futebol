import {
  TacticalPosition,
} from "./TacticalPositions";
import {
  TacticalPhase,
  TacticalRole,
} from "./RoleAttributeMapping";
export class RoleCompatibilityValidator {
  private static readonly COMPATIBILITY:
    Readonly<
      Record<
        TacticalPosition,
        readonly TacticalRole[]
      >
    > = {
      GK: [
        "GOALKEEPER",
        "SWEEPER_KEEPER",
        "LINE_GOALKEEPER",
      ],
      DR: [
        "FULL_BACK",
        "INVERTED_FULL_BACK",
      ],
      DCR: [
        "CENTRE_BACK",
        "BALL_PLAYING_CENTRE_BACK",
        "DIRECT_CENTRE_BACK",
        "COVER_CENTRE_BACK",
        "WIDE_CENTRE_BACK",
      ],
      DCC: [
        "CENTRE_BACK",
        "BALL_PLAYING_CENTRE_BACK",
        "DIRECT_CENTRE_BACK",
        "COVER_CENTRE_BACK",
      ],
      DCE: [
        "CENTRE_BACK",
        "BALL_PLAYING_CENTRE_BACK",
        "DIRECT_CENTRE_BACK",
        "COVER_CENTRE_BACK",
        "WIDE_CENTRE_BACK",
      ],
      DL: [
        "FULL_BACK",
        "INVERTED_FULL_BACK",
      ],
      WBR: [
        "WING_BACK",
        "PLAYMAKING_WING_BACK",
        "ATTACKING_WING_BACK",
      ],
      DMR: [
        "DEFENSIVE_MIDFIELDER",
        "BOX_TO_BOX_MIDFIELDER",
        "DEEP_LYING_PLAYMAKER",
        "HALF_BACK",
      ],
      DMC: [
        "DEFENSIVE_MIDFIELDER",
        "BOX_TO_BOX_MIDFIELDER",
        "DEEP_LYING_PLAYMAKER",
        "HALF_BACK",
      ],
      DME: [
        "DEFENSIVE_MIDFIELDER",
        "BOX_TO_BOX_MIDFIELDER",
        "DEEP_LYING_PLAYMAKER",
        "HALF_BACK",
      ],
      WBL: [
        "WING_BACK",
        "PLAYMAKING_WING_BACK",
        "ATTACKING_WING_BACK",
      ],
      MR: [
        "WIDE_MIDFIELDER",
        "WIDE_PLAYMAKER",
        "WINGER",
      ],
      MCR: [
        "CENTRAL_MIDFIELDER",
        "ADVANCED_PLAYMAKER",
        "MEZZALA",
        "WIDE_CENTRAL_MIDFIELDER",
      ],
      MCC: [
        "CENTRAL_MIDFIELDER",
        "ADVANCED_PLAYMAKER",
        "MEZZALA",
      ],
      MCL: [
        "CENTRAL_MIDFIELDER",
        "ADVANCED_PLAYMAKER",
        "MEZZALA",
        "WIDE_CENTRAL_MIDFIELDER",
      ],
      ML: [
        "WIDE_MIDFIELDER",
        "WIDE_PLAYMAKER",
        "WINGER",
      ],
      WR: [
        "WINGER",
        "INSIDE_FORWARD",
        "WIDE_PLAYMAKER",
      ],
      AMR: [
        "WIDE_PLAYMAKER",
        "INSIDE_FORWARD",
        "WINGER",
        "ATTACKING_MIDFIELDER",
        "ENGANCHE",
        "TREQUARTISTA",
        "SHADOW_STRIKER",
      ],
      AMC: [
        "ATTACKING_MIDFIELDER",
        "ENGANCHE",
        "TREQUARTISTA",
        "SHADOW_STRIKER",
      ],
      AML: [
        "WIDE_PLAYMAKER",
        "INSIDE_FORWARD",
        "WINGER",
        "ATTACKING_MIDFIELDER",
        "ENGANCHE",
        "TREQUARTISTA",
        "SHADOW_STRIKER",
      ],
      WL: [
        "WINGER",
        "INSIDE_FORWARD",
        "WIDE_PLAYMAKER",
      ],
      STR: [
        "CENTRE_FORWARD",
        "CHANNEL_FORWARD",
        "DEEP_LYING_FORWARD",
        "FALSE_NINE",
        "POACHER",
        "TARGET_FORWARD",
      ],
      STC: [
        "CENTRE_FORWARD",
        "CHANNEL_FORWARD",
        "DEEP_LYING_FORWARD",
        "FALSE_NINE",
        "POACHER",
        "TARGET_FORWARD",
      ],
      STL: [
        "CENTRE_FORWARD",
        "CHANNEL_FORWARD",
        "DEEP_LYING_FORWARD",
        "FALSE_NINE",
        "POACHER",
        "TARGET_FORWARD",
      ],
    };
  public static isCompatible(
    position: TacticalPosition,
    role: TacticalRole,
    phase?: TacticalPhase
  ): boolean {
    const positionRoles =
      this.COMPATIBILITY[
      position
      ];
    if (
      !positionRoles.includes(
        role
      )
    ) {
      return false;
    }
    if (
      !phase
    ) {
      return true;
    }
    if (
      phase === "IN_POSSESSION"
    ) {
      return [
        "GOALKEEPER",
        "SWEEPER_KEEPER",
        "LINE_GOALKEEPER",
        "CENTRE_BACK",
        "BALL_PLAYING_CENTRE_BACK",
        "DIRECT_CENTRE_BACK",
        "WIDE_CENTRE_BACK",
        "FULL_BACK",
        "INVERTED_FULL_BACK",
        "WING_BACK",
        "PLAYMAKING_WING_BACK",
        "ATTACKING_WING_BACK",
        "DEFENSIVE_MIDFIELDER",
        "BOX_TO_BOX_MIDFIELDER",
        "DEEP_LYING_PLAYMAKER",
        "HALF_BACK",
        "CENTRAL_MIDFIELDER",
        "ADVANCED_PLAYMAKER",
        "MEZZALA",
        "WIDE_CENTRAL_MIDFIELDER",
        "WIDE_MIDFIELDER",
        "INSIDE_FORWARD",
        "WIDE_PLAYMAKER",
        "WINGER",
        "ATTACKING_MIDFIELDER",
        "ENGANCHE",
        "TREQUARTISTA",
        "SHADOW_STRIKER",
        "CENTRE_FORWARD",
        "CHANNEL_FORWARD",
        "DEEP_LYING_FORWARD",
        "FALSE_NINE",
        "POACHER",
        "TARGET_FORWARD",
      ].includes(
        role
      );
    }
    return [
      "LINE_GOALKEEPER",
      "SWEEPER_KEEPER",
      "CENTRE_BACK",
      "DIRECT_CENTRE_BACK",
      "COVER_CENTRE_BACK",
      "WIDE_CENTRE_BACK",
      "FULL_BACK",
      "WING_BACK",
      "DEFENSIVE_MIDFIELDER",
      "CENTRAL_MIDFIELDER",
      "WIDE_MIDFIELDER",
      "ATTACKING_MIDFIELDER",
      "WINGER",
      "SHADOW_STRIKER",
      "CENTRE_FORWARD",
    ].includes(
      role
    );
  }
  public static assertCompatible(
    position: TacticalPosition,
    role: TacticalRole,
    phase?: TacticalPhase
  ): void {
    if (
      !this.isCompatible(
        position,
        role,
        phase
      )
    ) {
      throw new Error(
        `Role ${role} is not compatible ` +
        `with position ${position}` +
        (
          phase
            ? ` during ${phase}.`
            : "."
        )
      );
    }
  }
  public static getCompatibleRoles(
    position: TacticalPosition
  ): readonly TacticalRole[] {
    return this.COMPATIBILITY[
      position
    ];
  }
}
import {
  AttributeValue,
} from "./common";
import {
  PlayerAttributes,
} from "./PlayerBase";
export type RoleAttribute =
  keyof PlayerAttributes["mental"]
  | keyof PlayerAttributes["physical"]
  | keyof PlayerAttributes["technical"]
  | keyof PlayerAttributes["goalkeeping"];
export type TacticalPhase =
  | "IN_POSSESSION"
  | "OUT_OF_POSSESSION";
export type TacticalRole =
  // Goalkeeper
  | "GOALKEEPER"
  | "SWEEPER_KEEPER"
  | "LINE_GOALKEEPER"
  // Centre-back
  | "CENTRE_BACK"
  | "BALL_PLAYING_CENTRE_BACK"
  | "DIRECT_CENTRE_BACK"
  | "COVER_CENTRE_BACK"
  | "WIDE_CENTRE_BACK"
  // Full-back
  | "FULL_BACK"
  | "INVERTED_FULL_BACK"
  | "WING_BACK"
  | "PLAYMAKING_WING_BACK"
  | "ATTACKING_WING_BACK"
  // Defensive midfield
  | "DEFENSIVE_MIDFIELDER"
  | "BOX_TO_BOX_MIDFIELDER"
  | "DEEP_LYING_PLAYMAKER"
  | "HALF_BACK"
  // Central midfield
  | "CENTRAL_MIDFIELDER"
  | "ADVANCED_PLAYMAKER"
  | "MEZZALA"
  | "WIDE_CENTRAL_MIDFIELDER"
  // Wide midfield / attacking midfield
  | "WIDE_MIDFIELDER"
  | "INSIDE_FORWARD"
  | "WIDE_PLAYMAKER"
  | "WINGER"
  // Attacking midfield
  | "ATTACKING_MIDFIELDER"
  | "ENGANCHE"
  | "TREQUARTISTA"
  | "SHADOW_STRIKER"
  // Striker
  | "CENTRE_FORWARD"
  | "CHANNEL_FORWARD"
  | "DEEP_LYING_FORWARD"
  | "FALSE_NINE"
  | "POACHER"
  | "TARGET_FORWARD";
export interface RoleAttributeMapping {
  readonly key:
  readonly RoleAttribute[];
  readonly preferred:
  readonly RoleAttribute[];
  readonly unnecessary:
  readonly RoleAttribute[];
}
export interface RoleDefinition {
  readonly role:
  TacticalRole;
  readonly phase:
  TacticalPhase;
  readonly attributes:
  RoleAttributeMapping;
}
const role = (
  phase: TacticalPhase,
  key: readonly RoleAttribute[],
  preferred: readonly RoleAttribute[] = [],
  unnecessary: readonly RoleAttribute[] = []
): RoleAttributeMapping => {
  return {
    key,
    preferred,
    unnecessary,
  };
};
export const ROLE_ATTRIBUTE_MAPPINGS:
  Readonly<
    Record<
      TacticalPhase,
      Readonly<
        Partial<
          Record<
            TacticalRole,
            RoleAttributeMapping
          >
        >
      >
    >
  > = {
  IN_POSSESSION: {
    GOALKEEPER: role(
      "IN_POSSESSION",
      [
        "aerialReach",
        "commandOfArea",
        "communication",
        "kicking",
        "handling",
        "reflexes",
        "agility",
        "concentration",
        "positioning",
      ],
      [
        "eccentricity",
        "oneOnOnes",
        "throwing",
        "anticipation",
        "composure",
        "decisions",
        "passing",
      ]
    ),
    SWEEPER_KEEPER: role(
      "IN_POSSESSION",
      [
        "rushingOut",
        "anticipation",
        "decisions",
        "kicking",
        "passing",
        "composure",
        "positioning",
      ],
      [
        "firstTouch",
        "technique",
        "vision",
        "agility",
        "pace",
      ]
    ),
    LINE_GOALKEEPER: role(
      "IN_POSSESSION",
      [
        "handling",
        "reflexes",
        "positioning",
        "concentration",
        "aerialReach",
      ],
      [
        "oneOnOnes",
        "communication",
        "anticipation",
        "decisions",
      ],
      [
        "eccentricity",
        "passing",
      ]
    ),
    CENTRE_BACK: role(
      "IN_POSSESSION",
      [
        "heading",
        "marking",
        "tackling",
        "anticipation",
        "positioning",
        "jumpingReach",
        "strength",
      ],
      [
        "aggression",
        "bravery",
        "composure",
        "concentration",
        "decisions",
        "pace",
      ],
      [
        "passing",
      ]
    ),
    BALL_PLAYING_CENTRE_BACK: role(
      "IN_POSSESSION",
      [
        "heading",
        "marking",
        "passing",
        "tackling",
        "technique",
        "anticipation",
        "composure",
        "decisions",
        "positioning",
        "teamwork",
        "jumpingReach",
        "strength",
      ],
      [
        "dribbling",
        "firstTouch",
        "aggression",
        "bravery",
        "concentration",
        "vision",
        "pace",
        "stamina",
      ]
    ),
    DIRECT_CENTRE_BACK: role(
      "IN_POSSESSION",
      [
        "heading",
        "marking",
        "tackling",
        "anticipation",
        "positioning",
        "jumpingReach",
        "strength",
      ],
      [
        "aggression",
        "bravery",
        "concentration",
        "pace",
      ],
      [
        "passing",
        "composure",
      ]
    ),
    WIDE_CENTRE_BACK: role(
      "IN_POSSESSION",
      [
        "heading",
        "marking",
        "tackling",
        "anticipation",
        "positioning",
        "jumpingReach",
        "strength",
      ],
      [
        "dribbling",
        "aggression",
        "bravery",
        "composure",
        "concentration",
        "decisions",
        "workRate",
        "acceleration",
        "agility",
        "pace",
        "stamina",
      ],
      [
        "passing",
      ]
    ),
    FULL_BACK: role(
      "IN_POSSESSION",
      [
        "marking",
        "tackling",
        "anticipation",
        "concentration",
        "positioning",
        "teamwork",
        "acceleration",
      ],
      [
        "crossing",
        "dribbling",
        "passing",
        "technique",
        "decisions",
        "workRate",
        "agility",
        "pace",
        "stamina",
      ]
    ),
    INVERTED_FULL_BACK: role(
      "IN_POSSESSION",
      [
        "passing",
        "tackling",
        "anticipation",
        "composure",
        "decisions",
        "positioning",
        "teamwork",
        "acceleration",
      ],
      [
        "firstTouch",
        "marking",
        "technique",
        "concentration",
        "workRate",
        "agility",
        "pace",
        "stamina",
      ]
    ),
    WING_BACK: role(
      "IN_POSSESSION",
      [
        "crossing",
        "dribbling",
        "technique",
        "offTheBall",
        "teamwork",
        "workRate",
        "acceleration",
        "agility",
        "pace",
        "stamina",
      ],
      [
        "firstTouch",
        "marking",
        "passing",
        "tackling",
        "anticipation",
        "decisions",
        "flair",
        "positioning",
        "balance",
      ]
    ),
    PLAYMAKING_WING_BACK: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "passing",
        "tackling",
        "technique",
        "composure",
        "decisions",
        "positioning",
        "teamwork",
        "vision",
        "acceleration",
      ],
      [
        "crossing",
        "dribbling",
        "marking",
        "anticipation",
        "concentration",
        "offTheBall",
        "workRate",
        "agility",
        "pace",
        "stamina",
      ]
    ),
    ATTACKING_WING_BACK: role(
      "IN_POSSESSION",
      [
        "crossing",
        "dribbling",
        "technique",
        "offTheBall",
        "teamwork",
        "workRate",
        "acceleration",
        "agility",
        "pace",
        "stamina",
      ],
      [
        "firstTouch",
        "marking",
        "passing",
        "tackling",
        "anticipation",
        "decisions",
        "flair",
        "positioning",
        "balance",
      ]
    ),
    DEFENSIVE_MIDFIELDER: role(
      "IN_POSSESSION",
      [
        "tackling",
        "anticipation",
        "concentration",
        "positioning",
        "teamwork",
      ],
      [
        "firstTouch",
        "marking",
        "passing",
        "aggression",
        "composure",
        "decisions",
        "workRate",
        "stamina",
        "strength",
      ]
    ),
    BOX_TO_BOX_MIDFIELDER: role(
      "IN_POSSESSION",
      [
        "passing",
        "tackling",
        "offTheBall",
        "teamwork",
        "workRate",
        "stamina",
      ],
      [
        "dribbling",
        "finishing",
        "firstTouch",
        "longShots",
        "technique",
        "aggression",
        "anticipation",
        "composure",
        "decisions",
        "positioning",
        "acceleration",
        "balance",
        "pace",
        "strength",
      ]
    ),
    DEEP_LYING_PLAYMAKER: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "passing",
        "technique",
        "composure",
        "decisions",
        "teamwork",
        "vision",
      ],
      [
        "marking",
        "tackling",
        "anticipation",
        "concentration",
        "positioning",
        "workRate",
        "balance",
        "stamina",
      ]
    ),
    HALF_BACK: role(
      "IN_POSSESSION",
      [
        "anticipation",
        "marking",
        "tackling",
        "concentration",
        "positioning",
        "teamwork",
        "jumpingReach",
        "strength",
      ],
      [
        "firstTouch",
        "passing",
        "aggression",
        "bravery",
        "composure",
        "decisions",
        "workRate",
        "stamina",
      ]
    ),
    CENTRAL_MIDFIELDER: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "passing",
        "tackling",
        "decisions",
        "teamwork",
      ],
      [
        "technique",
        "anticipation",
        "composure",
        "concentration",
        "offTheBall",
        "positioning",
        "vision",
        "workRate",
        "stamina",
      ]
    ),
    ADVANCED_PLAYMAKER: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "passing",
        "technique",
        "composure",
        "decisions",
        "offTheBall",
        "teamwork",
        "vision",
      ],
      [
        "crossing",
        "dribbling",
        "anticipation",
        "flair",
        "acceleration",
        "agility",
      ]
    ),
    MEZZALA: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "passing",
        "technique",
        "composure",
        "decisions",
        "offTheBall",
        "teamwork",
        "vision",
      ],
      [
        "dribbling",
        "tackling",
        "anticipation",
        "flair",
        "positioning",
        "workRate",
        "agility",
        "stamina",
      ]
    ),
    WIDE_CENTRAL_MIDFIELDER: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "passing",
        "tackling",
        "decisions",
        "teamwork",
      ],
      [
        "crossing",
        "dribbling",
        "technique",
        "anticipation",
        "composure",
        "concentration",
        "offTheBall",
        "positioning",
        "vision",
        "workRate",
        "agility",
        "stamina",
      ]
    ),
    WIDE_MIDFIELDER: role(
      "IN_POSSESSION",
      [
        "crossing",
        "passing",
        "technique",
        "teamwork",
        "workRate",
        "pace",
        "stamina",
      ],
      [
        "dribbling",
        "firstTouch",
        "anticipation",
        "composure",
        "offTheBall",
        "vision",
        "acceleration",
        "agility",
      ]
    ),
    INSIDE_FORWARD: role(
      "IN_POSSESSION",
      [
        "dribbling",
        "firstTouch",
        "technique",
        "composure",
        "teamwork",
        "acceleration",
        "agility",
      ],
      [
        "crossing",
        "longShots",
        "passing",
        "anticipation",
        "flair",
        "offTheBall",
        "vision",
        "workRate",
        "balance",
        "pace",
        "stamina",
      ]
    ),
    WIDE_PLAYMAKER: role(
      "IN_POSSESSION",
      [
        "crossing",
        "dribbling",
        "firstTouch",
        "passing",
        "technique",
        "composure",
        "decisions",
        "offTheBall",
        "teamwork",
        "vision",
        "acceleration",
      ],
      [
        "anticipation",
        "flair",
        "workRate",
        "agility",
        "pace",
        "stamina",
      ]
    ),
    WINGER: role(
      "IN_POSSESSION",
      [
        "crossing",
        "dribbling",
        "technique",
        "teamwork",
        "acceleration",
        "agility",
        "pace",
      ],
      [
        "firstTouch",
        "passing",
        "anticipation",
        "flair",
        "offTheBall",
        "workRate",
        "balance",
        "stamina",
      ]
    ),
    ATTACKING_MIDFIELDER: role(
      "IN_POSSESSION",
      [
        "firstTouch",
        "longShots",
        "passing",
        "technique",
        "composure",
        "flair",
        "offTheBall",
      ],
      [
        "crossing",
        "dribbling",
        "finishing",
        "anticipation",
        "decisions",
        "vision",
        "acceleration",
        "agility",
      ]
    ),
    ENGANCHE: role(
      "IN_POSSESSION",
      [
        "crossing",
        "firstTouch",
        "passing",
        "technique",
        "composure",
        "offTheBall",
        "workRate",
        "acceleration",
      ],
      [
        "dribbling",
        "longShots",
        "anticipation",
        "decisions",
        "flair",
        "vision",
        "agility",
        "pace",
        "stamina",
      ]
    ),
    TREQUARTISTA: role(
      "IN_POSSESSION",
      [
        "dribbling",
        "firstTouch",
        "longShots",
        "passing",
        "technique",
        "composure",
        "flair",
        "offTheBall",
        "vision",
      ],
      [
        "crossing",
        "finishing",
        "anticipation",
        "decisions",
        "acceleration",
        "agility",
      ]
    ),
    SHADOW_STRIKER: role(
      "IN_POSSESSION",
      [
        "finishing",
        "firstTouch",
        "anticipation",
        "composure",
        "offTheBall",
        "acceleration",
      ],
      [
        "dribbling",
        "longShots",
        "passing",
        "technique",
        "concentration",
        "decisions",
        "workRate",
        "agility",
        "pace",
        "stamina",
      ]
    ),
    CENTRE_FORWARD: role(
      "IN_POSSESSION",
      [
        "finishing",
        "firstTouch",
        "heading",
        "technique",
        "composure",
        "offTheBall",
        "acceleration",
        "strength",
      ],
      [
        "dribbling",
        "passing",
        "anticipation",
        "decisions",
        "agility",
        "balance",
        "jumpingReach",
        "pace",
      ]
    ),
    CHANNEL_FORWARD: role(
      "IN_POSSESSION",
      [
        "dribbling",
        "finishing",
        "firstTouch",
        "technique",
        "composure",
        "offTheBall",
        "workRate",
        "acceleration",
      ],
      [
        "crossing",
        "heading",
        "passing",
        "anticipation",
        "decisions",
        "agility",
        "balance",
        "pace",
        "stamina",
      ]
    ),
    DEEP_LYING_FORWARD: role(
      "IN_POSSESSION",
      [
        "finishing",
        "firstTouch",
        "technique",
        "composure",
        "offTheBall",
        "strength",
      ],
      [
        "dribbling",
        "passing",
        "anticipation",
        "decisions",
        "teamwork",
        "vision",
        "balance",
      ]
    ),
    FALSE_NINE: role(
      "IN_POSSESSION",
      [
        "dribbling",
        "firstTouch",
        "passing",
        "technique",
        "composure",
        "decisions",
        "offTheBall",
        "teamwork",
        "vision",
        "acceleration",
      ],
      [
        "finishing",
        "anticipation",
        "flair",
        "agility",
        "balance",
      ]
    ),
    POACHER: role(
      "IN_POSSESSION",
      [
        "finishing",
        "heading",
        "anticipation",
        "composure",
        "concentration",
        "offTheBall",
        "acceleration",
      ],
      [
        "firstTouch",
        "technique",
        "decisions",
        "balance",
      ]
    ),
    TARGET_FORWARD: role(
      "IN_POSSESSION",
      [
        "finishing",
        "heading",
        "aggression",
        "bravery",
        "composure",
        "offTheBall",
        "balance",
        "jumpingReach",
        "strength",
      ],
      [
        "firstTouch",
        "anticipation",
        "decisions",
        "teamwork",
      ]
    ),
  },
  OUT_OF_POSSESSION: {
    LINE_GOALKEEPER: role(
      "OUT_OF_POSSESSION",
      [
        "positioning",
        "concentration",
      ]
    ),
    SWEEPER_KEEPER: role(
      "OUT_OF_POSSESSION",
      [
        "rushingOut",
        "anticipation",
        "decisions",
      ]
    ),
    COVER_CENTRE_BACK: role(
      "OUT_OF_POSSESSION",
      [
        "anticipation",
        "pace",
        "marking",
      ]
    ),
    CENTRE_BACK: role(
      "OUT_OF_POSSESSION",
      [
        "aggression",
        "tackling",
        "strength",
      ]
    ),
    WIDE_CENTRE_BACK: role(
      "OUT_OF_POSSESSION",
      [
        "anticipation",
        "pace",
        "marking",
      ]
    ),
    FULL_BACK: role(
      "OUT_OF_POSSESSION",
      [
        "positioning",
        "concentration",
        "marking",
      ]
    ),
    WING_BACK: role(
      "OUT_OF_POSSESSION",
      [
        "aggression",
        "workRate",
        "anticipation",
      ]
    ),
    DEFENSIVE_MIDFIELDER: role(
      "OUT_OF_POSSESSION",
      [
        "positioning",
        "decisions",
        "anticipation",
      ]
    ),
    CENTRAL_MIDFIELDER: role(
      "OUT_OF_POSSESSION",
      [
        "aggression",
        "workRate",
        "anticipation",
      ]
    ),
    WIDE_MIDFIELDER: role(
      "OUT_OF_POSSESSION",
      [
        "marking",
        "workRate",
        "stamina",
      ]
    ),
    ATTACKING_MIDFIELDER: role(
      "OUT_OF_POSSESSION",
      [
        "marking",
        "workRate",
        "stamina",
      ]
    ),
    WINGER: role(
      "OUT_OF_POSSESSION",
      [
        "marking",
        "workRate",
        "stamina",
      ]
    ),
    SHADOW_STRIKER: role(
      "OUT_OF_POSSESSION",
      [
        "marking",
        "workRate",
        "stamina",
      ]
    ),
    CENTRE_FORWARD: role(
      "OUT_OF_POSSESSION",
      [
        "offTheBall",
        "decisions",
        "anticipation",
      ]
    ),
  },
};
export function getRoleDefinition(
  phase: TacticalPhase,
  roleName: TacticalRole
): RoleDefinition {
  const attributes =
    ROLE_ATTRIBUTE_MAPPINGS[
    phase
    ][
    roleName
    ];
  if (!attributes) {
    throw new Error(
      `Role ${roleName} is not defined for phase ${phase}.`
    );
  }
  return {
    role: roleName,
    phase,
    attributes,
  };
}
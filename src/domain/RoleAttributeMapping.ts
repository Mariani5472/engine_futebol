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
  // ============================================================
  // GOALKEEPER
  // ============================================================

  | "GOALKEEPER"
  | "SWEEPER_KEEPER"
  | "DIRECT_GOALKEEPER"
  | "LINE_GOALKEEPER"

  // ============================================================
  // CENTRE-BACK
  // ============================================================

  | "CENTRE_BACK"
  | "BALL_PLAYING_CENTRE_BACK"
  | "DIRECT_CENTRE_BACK"
  | "WIDE_CENTRE_BACK"
  | "ADVANCED_CENTRE_BACK"
  | "OVERLAPPING_CENTRE_BACK"

  // Out of possession
  | "COVER_CENTRE_BACK"
  | "DEFENSIVE_CENTRE_BACK"
  | "WIDE_COVER_CENTRE_BACK"

  // ============================================================
  // FULL-BACK
  // ============================================================

  | "FULL_BACK"
  | "INVERTED_FULL_BACK"
  | "WING_BACK"
  | "PLAYMAKING_WING_BACK"
  | "ATTACKING_WING_BACK"

  // Out of possession
  | "DEFENSIVE_FULL_BACK"
  | "PRESSING_FULL_BACK"

  // ============================================================
  // WING-BACK
  // ============================================================

  | "DEFENSIVE_WING_BACK"
  | "PRESSING_WING_BACK"

  // ============================================================
  // DEFENSIVE MIDFIELDER
  // ============================================================

  | "DEFENSIVE_MIDFIELDER"
  | "BOX_TO_BOX_MIDFIELDER"
  | "DEEP_LYING_PLAYMAKER"
  | "HALF_BACK"

  // Out of possession
  | "DISPOSSESSING_DEFENSIVE_MIDFIELDER"
  | "PRESSING_DEFENSIVE_MIDFIELDER"
  | "PROTECTIVE_DEFENSIVE_MIDFIELDER"
  | "WIDE_COVER_DEFENSIVE_MIDFIELDER"

  // ============================================================
  // CENTRAL MIDFIELDER
  // ============================================================

  | "CENTRAL_MIDFIELDER"
  | "ADVANCED_PLAYMAKER"
  | "MEZZALA"
  | "WIDE_CENTRAL_MIDFIELDER"

  // Out of possession
  | "PRESSING_CENTRAL_MIDFIELDER"
  | "PROTECTIVE_CENTRAL_MIDFIELDER"
  | "WIDE_COVER_CENTRAL_MIDFIELDER"

  // ============================================================
  // WIDE MIDFIELDER
  // ============================================================

  | "WIDE_MIDFIELDER"

  // Out of possession
  | "TRACKING_WIDE_MIDFIELDER"
  | "WIDE_OUTLET_MIDFIELDER"

  // ============================================================
  // WIDE MIDFIELDER / ATTACKING MIDFIELDER
  // ============================================================

  | "INSIDE_FORWARD"
  | "WIDE_PLAYMAKER"
  | "WINGER"

  // Out of possession
  | "INSIDE_OUTLET_WINGER"
  | "TRACKING_WINGER"
  | "WIDE_OUTLET_WINGER"

  // ============================================================
  // ATTACKING MIDFIELDER
  // ============================================================

  | "ATTACKING_MIDFIELDER"
  | "ENGANCHE"
  | "TREQUARTISTA"
  | "SHADOW_STRIKER"

  // Out of possession
  | "CENTRAL_OUTLET_ATTACKING_MIDFIELDER"
  | "SPLITTING_OUTLET_ATTACKING_MIDFIELDER"
  | "TRACKING_ATTACKING_MIDFIELDER"

  // ============================================================
  // STRIKER
  // ============================================================

  | "CENTRE_FORWARD"
  | "CHANNEL_FORWARD"
  | "DEEP_LYING_FORWARD"
  | "FALSE_NINE"
  | "POACHER"
  | "TARGET_FORWARD"

  // Out of possession
  | "CENTRAL_OUTLET_CENTRE_FORWARD"
  | "SPLITTING_OUTLET_CENTRE_FORWARD"
  | "TRACKING_CENTRE_FORWARD";

export interface RoleAttributeMapping {
  readonly key: readonly RoleAttribute[];
  readonly preferred: readonly RoleAttribute[];
  readonly unnecessary: readonly RoleAttribute[];
}

export interface RoleDefinition {
  readonly role: TacticalRole;
  readonly phase: TacticalPhase;
  readonly attributes: RoleAttributeMapping;
}

const role = (
  key: readonly RoleAttribute[],
  preferred: readonly RoleAttribute[] = [],
  unnecessary: readonly RoleAttribute[] = []
): RoleAttributeMapping => ({
  key,
  preferred,
  unnecessary,
});

export const ROLE_ATTRIBUTE_MAPPINGS: Readonly<
  Record<
    TacticalPhase,
    Readonly<
      Partial<
        Record<TacticalRole, RoleAttributeMapping>
      >
    >
  >
> = {


  IN_POSSESSION: {


    GOALKEEPER: role(
      [
        "aerialReach",
        "commandOfArea",
        "communication",
        "kicking",
        "reflexes",
        "agility",
        "concentration",
        "positioning",
      ],
      [
        "finishing",
        "oneOnOnes",
        "throwing",
        "anticipation",
        "decisions",
      ],
      [
        "eccentricity",
      ]
    ),

    SWEEPER_KEEPER: role(
      [
        "aerialReach",
        "commandOfArea",
        "communication",
        "kicking",
        "finishing",
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

    DIRECT_GOALKEEPER: role(
      [
        "aerialReach",
        "commandOfArea",
        "communication",
        "kicking",
        "reflexes",
        "agility",
        "concentration",
        "positioning",
      ],
      [
        "oneOnOnes",
        "anticipation",
        "decisions",
      ],
      [
        "eccentricity",
        "passing",
      ]
    ),

    // ==========================================================
    // CENTRE-BACK
    // ==========================================================

    CENTRE_BACK: role(
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

    ADVANCED_CENTRE_BACK: role(
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

    OVERLAPPING_CENTRE_BACK: role(
      [
        "crossing",
        "heading",
        "marking",
        "tackling",
        "anticipation",
        "workRate",
        "jumpingReach",
        "pace",
        "stamina",
        "strength",
      ],
      [
        "dribbling",
        "technique",
        "aggression",
        "bravery",
        "composure",
        "concentration",
        "decisions",
        "offTheBall",
        "positioning",
        "acceleration",
        "agility",
      ]
    ),

    // ==========================================================
    // FULL-BACK
    // ==========================================================

    FULL_BACK: role(
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
      [
        "heading",
        "marking",
        "tackling",
        "anticipation",
        "positioning",
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
        "jumpingReach",
        "pace",
        "stamina",
      ]
    ),

    WING_BACK: role(
      [
        "firstTouch",
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
        "crossing",
        "dribbling",
        "marking",
        "technique",
        "concentration",
        "workRate",
        "agility",
        "pace",
        "stamina",
      ]
    ),

    PLAYMAKING_WING_BACK: role(
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

    // ==========================================================
    // DEFENSIVE MIDFIELD
    // ==========================================================

    DEFENSIVE_MIDFIELDER: role(
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
      [
        "heading",
        "marking",
        "tackling",
        "anticipation",
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

    // ==========================================================
    // CENTRAL MIDFIELD
    // ==========================================================

    CENTRAL_MIDFIELDER: role(
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

    // ==========================================================
    // WIDE MIDFIELD
    // ==========================================================

    WIDE_MIDFIELDER: role(
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

    // ==========================================================
    // ATTACKING MIDFIELD
    // ==========================================================

    ATTACKING_MIDFIELDER: role(
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

    // ==========================================================
    // STRIKER
    // ==========================================================

    CENTRE_FORWARD: role(
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

  // ============================================================
  // OUT OF POSSESSION
  // ============================================================

  OUT_OF_POSSESSION: {

    // ==========================================================
    // GOALKEEPER
    // ==========================================================

    LINE_GOALKEEPER: role([
      "positioning",
      "concentration",
    ]),

    SWEEPER_KEEPER: role([
      "rushingOut",
      "anticipation",
      "decisions",
    ]),

    // ==========================================================
    // CENTRE-BACK
    // ==========================================================

    COVER_CENTRE_BACK: role([
      "anticipation",
      "pace",
      "marking",
    ]),

    CENTRE_BACK: role([
      "aggression",
      "tackling",
      "strength",
    ]),

    WIDE_CENTRE_BACK: role([
      "anticipation",
      "pace",
      "marking",
    ]),

    // ==========================================================
    // FULL-BACK
    // ==========================================================

    DEFENSIVE_FULL_BACK: role([
      "positioning",
      "concentration",
      "marking",
    ]),

    PRESSING_FULL_BACK: role([
      "aggression",
      "workRate",
      "anticipation",
    ]),

    // ==========================================================
    // WING-BACK
    // ==========================================================

    DEFENSIVE_WING_BACK: role([
      "positioning",
      "concentration",
      "marking",
    ]),

    PRESSING_WING_BACK: role([
      "aggression",
      "workRate",
      "anticipation",
    ]),

    // ==========================================================
    // DEFENSIVE MIDFIELDER
    // ==========================================================

    DEFENSIVE_MIDFIELDER: role([
      "positioning",
      "decisions",
      "anticipation",
    ]),

    DISPOSSESSING_DEFENSIVE_MIDFIELDER: role([
      "positioning",
      "decisions",
      "anticipation",
    ]),

    PRESSING_DEFENSIVE_MIDFIELDER: role([
      "aggression",
      "workRate",
      "anticipation",
    ]),

    PROTECTIVE_DEFENSIVE_MIDFIELDER: role([
      "positioning",
      "concentration",
      "marking",
    ]),

    WIDE_COVER_DEFENSIVE_MIDFIELDER: role([
      "anticipation",
      "pace",
      "workRate",
    ]),

    // ==========================================================
    // CENTRAL MIDFIELDER
    // ==========================================================

    PRESSING_CENTRAL_MIDFIELDER: role([
      "aggression",
      "workRate",
      "anticipation",
    ]),

    PROTECTIVE_CENTRAL_MIDFIELDER: role([
      "positioning",
      "concentration",
      "marking",
    ]),

    WIDE_COVER_CENTRAL_MIDFIELDER: role([
      "anticipation",
      "pace",
      "workRate",
    ]),

    // ==========================================================
    // WIDE MIDFIELDER
    // ==========================================================

    TRACKING_WIDE_MIDFIELDER: role([
      "marking",
      "workRate",
      "stamina",
    ]),

    WIDE_OUTLET_MIDFIELDER: role([
      "offTheBall",
      "pace",
      "anticipation",
    ]),

    // ==========================================================
    // WIDE / ATTACKING MIDFIELDER
    // ==========================================================

    INSIDE_OUTLET_WINGER: role([
      "offTheBall",
      "decisions",
      "anticipation",
    ]),

    TRACKING_WINGER: role([
      "marking",
      "workRate",
      "stamina",
    ]),

    WIDE_OUTLET_WINGER: role([
      "offTheBall",
      "pace",
      "anticipation",
    ]),

    // ==========================================================
    // ATTACKING MIDFIELDER
    // ==========================================================

    CENTRAL_OUTLET_ATTACKING_MIDFIELDER: role([
      "offTheBall",
      "decisions",
      "anticipation",
    ]),

    SPLITTING_OUTLET_ATTACKING_MIDFIELDER: role([
      "offTheBall",
      "pace",
      "anticipation",
    ]),

    TRACKING_ATTACKING_MIDFIELDER: role([
      "marking",
      "workRate",
      "stamina",
    ]),

    // ==========================================================
    // STRIKER
    // ==========================================================

    CENTRAL_OUTLET_CENTRE_FORWARD: role([
      "offTheBall",
      "decisions",
      "anticipation",
    ]),

    SPLITTING_OUTLET_CENTRE_FORWARD: role([
      "offTheBall",
      "pace",
      "anticipation",
    ]),

    TRACKING_CENTRE_FORWARD: role([
      "marking",
      "workRate",
      "stamina",
    ]),
  },
};

export function getRoleDefinition(
  phase: TacticalPhase,
  roleName: TacticalRole
): RoleDefinition {
  const attributes =
    ROLE_ATTRIBUTE_MAPPINGS[phase][roleName];

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
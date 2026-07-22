import {
  PlayerPosition,
} from "./PlayerBase";

export type FormationName =
  | "4-4-2"
  | "4-3-3"
  | "4-2-3-1"
  | "4-4-1-1"
  | "3-5-2"
  | "3-4-3"
  | "5-3-2"
  | "5-4-1";

export interface FormationDefinition {

  readonly name: FormationName;

  readonly positions:
  readonly PlayerPosition[];
}

export interface FormationValidationResult {

  readonly valid: boolean;

  readonly errors:
  readonly string[];
}

const FORMATIONS:
  Readonly<
    Record<
      FormationName,
      FormationDefinition
    >
  > = {

  "4-4-2": {
    name: "4-4-2",

    positions: [
      "GK",

      "DL",
      "DC",
      "DC",
      "DR",

      "ML",
      "MC",
      "MC",
      "MR",

      "ST",
      "ST",
    ],
  },

  "4-3-3": {
    name: "4-3-3",

    positions: [
      "GK",

      "DL",
      "DC",
      "DC",
      "DR",

      "MC",
      "MC",
      "MC",

      "WL",
      "ST",
      "WR",
    ],
  },

  "4-2-3-1": {
    name: "4-2-3-1",

    positions: [
      "GK",

      "DL",
      "DC",
      "DC",
      "DR",

      "DM",
      "DM",

      "WL",
      "AMC",
      "WR",

      "ST",
    ],
  },

  "4-4-1-1": {
    name: "4-4-1-1",

    positions: [
      "GK",

      "DL",
      "DC",
      "DC",
      "DR",

      "ML",
      "MC",
      "MC",
      "MR",

      "AMC",

      "ST",
    ],
  },

  "3-5-2": {
    name: "3-5-2",

    positions: [
      "GK",

      "DC",
      "DC",
      "DC",

      "WBL",
      "MC",
      "DM",
      "MC",
      "WBR",

      "ST",
      "ST",
    ],
  },

  "3-4-3": {
    name: "3-4-3",

    positions: [
      "GK",

      "DC",
      "DC",
      "DC",

      "ML",
      "MC",
      "MC",
      "MR",

      "WL",
      "ST",
      "WR",
    ],
  },

  "5-3-2": {
    name: "5-3-2",

    positions: [
      "GK",

      "WBL",
      "DC",
      "DC",
      "DC",
      "WBR",

      "MC",
      "MC",
      "MC",

      "ST",
      "ST",
    ],
  },

  "5-4-1": {
    name: "5-4-1",

    positions: [
      "GK",

      "WBL",
      "DC",
      "DC",
      "DC",
      "WBR",

      "ML",
      "MC",
      "MC",
      "MR",

      "ST",
    ],
  },
};

export class FormationValidator {

  public static isValidFormation(
    formation: string
  ): formation is FormationName {

    return (
      formation in FORMATIONS
    );
  }

  public static getDefinition(
    formation: FormationName
  ): FormationDefinition {

    return FORMATIONS[
      formation
    ];
  }

  public static validate(
    formation: FormationName,
    positions: readonly PlayerPosition[]
  ): FormationValidationResult {

    const errors: string[] = [];

    const definition =
      FORMATIONS[
      formation
      ];

    if (
      !definition
    ) {
      return {
        valid: false,

        errors: [
          `Unknown formation: ${formation}`,
        ],
      };
    }

    if (
      positions.length !==
      definition.positions.length
    ) {
      errors.push(
        `Formation ${formation} requires ` +
        `${definition.positions.length} players.`
      );
    }

    const goalkeeperCount =
      positions.filter(
        position =>
          position === "GK"
      ).length;

    if (
      goalkeeperCount !== 1
    ) {
      errors.push(
        "A formation must contain exactly one goalkeeper."
      );
    }

    const expectedCounts =
      this.countPositions(
        definition.positions
      );

    const actualCounts =
      this.countPositions(
        positions
      );

    for (
      const [
        position,
        expectedCount,
      ]
      of Object.entries(
        expectedCounts
      )
    ) {

      const actualCount =
        actualCounts[
        position as PlayerPosition
        ] ??
        0;

      if (
        actualCount !==
        expectedCount
      ) {
        errors.push(
          `Formation ${formation} requires ` +
          `${expectedCount} ${position}, ` +
          `received ${actualCount}.`
        );
      }
    }

    return {
      valid:
        errors.length === 0,

      errors,
    };
  }

  public static assertValid(
    formation: FormationName,
    positions: readonly PlayerPosition[]
  ): void {

    const result =
      this.validate(
        formation,
        positions
      );

    if (
      !result.valid
    ) {
      throw new Error(
        result.errors.join(
          " "
        )
      );
    }
  }

  private static countPositions(
    positions: readonly PlayerPosition[]
  ): Partial<
    Record<
      PlayerPosition,
      number
    >
  > {

    const counts:
      Partial<
        Record<
          PlayerPosition,
          number
        >
      > = {};

    for (
      const position
      of positions
    ) {
      counts[position] =
        (
          counts[position] ??
          0
        ) + 1;
    }

    return counts;
  }
}
export const TACTICAL_POSITIONS = [
  "GK",
  "DR",
  "DCR",
  "DCC",
  "DCE",
  "DL",
  "WBR",
  "DMR",
  "DMC",
  "DME",
  "WBL",
  "MR",
  "MCR",
  "MCC",
  "MCL",
  "ML",
  "WR",
  "AMR",
  "AMC",
  "AML",
  "WL",
  "STR",
  "STC",
  "STL",
] as const;
export type TacticalPosition =
  typeof TACTICAL_POSITIONS[number];
export type PositionFamily =
  | "GOALKEEPER"
  | "CENTRE_BACK"
  | "RIGHT_FULL_BACK"
  | "LEFT_FULL_BACK"
  | "RIGHT_WING_BACK"
  | "LEFT_WING_BACK"
  | "DEFENSIVE_MIDFIELDER"
  | "CENTRAL_MIDFIELDER"
  | "RIGHT_WIDE_MIDFIELDER"
  | "LEFT_WIDE_MIDFIELDER"
  | "ATTACKING_MIDFIELDER"
  | "RIGHT_WINGER"
  | "LEFT_WINGER"
  | "STRIKER";
export type TacticalSide =
  | "LEFT"
  | "RIGHT"
  | "CENTRE";
export const POSITION_FAMILY_BY_SPOT:
  Readonly<
    Record<
      TacticalPosition,
      PositionFamily
    >
  > = {
  GK: "GOALKEEPER",
  DR: "RIGHT_FULL_BACK",
  DCR: "CENTRE_BACK",
  DCC: "CENTRE_BACK",
  DCE: "CENTRE_BACK",
  DL: "LEFT_FULL_BACK",
  WBR: "RIGHT_WING_BACK",
  DMR: "DEFENSIVE_MIDFIELDER",
  DMC: "DEFENSIVE_MIDFIELDER",
  DME: "DEFENSIVE_MIDFIELDER",
  WBL: "LEFT_WING_BACK",
  MR: "RIGHT_WIDE_MIDFIELDER",
  MCR: "CENTRAL_MIDFIELDER",
  MCC: "CENTRAL_MIDFIELDER",
  MCL: "CENTRAL_MIDFIELDER",
  ML: "LEFT_WIDE_MIDFIELDER",
  WR: "RIGHT_WINGER",
  AMR: "ATTACKING_MIDFIELDER",
  AMC: "ATTACKING_MIDFIELDER",
  AML: "ATTACKING_MIDFIELDER",
  WL: "LEFT_WINGER",
  STR: "STRIKER",
  STC: "STRIKER",
  STL: "STRIKER",
};
export const POSITION_SIDE_BY_SPOT:
  Readonly<
    Record<
      TacticalPosition,
      TacticalSide
    >
  > = {
  GK: "CENTRE",
  DR: "RIGHT",
  DCR: "RIGHT",
  DCC: "CENTRE",
  DCE: "LEFT",
  DL: "LEFT",
  WBR: "RIGHT",
  DMR: "RIGHT",
  DMC: "CENTRE",
  DME: "LEFT",
  WBL: "LEFT",
  MR: "RIGHT",
  MCR: "RIGHT",
  MCC: "CENTRE",
  MCL: "LEFT",
  ML: "LEFT",
  WR: "RIGHT",
  AMR: "RIGHT",
  AMC: "CENTRE",
  AML: "LEFT",
  WL: "LEFT",
  STR: "RIGHT",
  STC: "CENTRE",
  STL: "LEFT",
};
export const POSITION_FAMILY_SPOTS:
  Readonly<
    Record<
      PositionFamily,
      readonly TacticalPosition[]
    >
  > = {
  GOALKEEPER: [
    "GK",
  ],
  CENTRE_BACK: [
    "DCR",
    "DCC",
    "DCE",
  ],
  RIGHT_FULL_BACK: [
    "DR",
  ],
  LEFT_FULL_BACK: [
    "DL",
  ],
  RIGHT_WING_BACK: [
    "WBR",
  ],
  LEFT_WING_BACK: [
    "WBL",
  ],
  DEFENSIVE_MIDFIELDER: [
    "DMR",
    "DMC",
    "DME",
  ],
  CENTRAL_MIDFIELDER: [
    "MCR",
    "MCC",
    "MCL",
  ],
  RIGHT_WIDE_MIDFIELDER: [
    "MR",
  ],
  LEFT_WIDE_MIDFIELDER: [
    "ML",
  ],
  ATTACKING_MIDFIELDER: [
    "AMR",
    "AMC",
    "AML",
  ],
  RIGHT_WINGER: [
    "WR",
  ],
  LEFT_WINGER: [
    "WL",
  ],
  STRIKER: [
    "STR",
    "STC",
    "STL",
  ],
};
export function isTacticalPosition(
  value: string
): value is TacticalPosition {
  return TACTICAL_POSITIONS.includes(
    value as TacticalPosition
  );
}
export function getPositionFamily(
  position: TacticalPosition
): PositionFamily {
  return POSITION_FAMILY_BY_SPOT[
    position
  ];
}
export function getPositionSide(
  position: TacticalPosition
): TacticalSide {
  return POSITION_SIDE_BY_SPOT[
    position
  ];
}
export function areSamePositionFamily(
  first: TacticalPosition,
  second: TacticalPosition
): boolean {
  return (
    getPositionFamily(first) ===
    getPositionFamily(second)
  );
}
export function areOppositeSides(
  first: TacticalPosition,
  second: TacticalPosition
): boolean {
  const firstSide =
    getPositionSide(first);
  const secondSide =
    getPositionSide(second);
  return (
    (
      firstSide === "LEFT" &&
      secondSide === "RIGHT"
    ) ||
    (
      firstSide === "RIGHT" &&
      secondSide === "LEFT"
    )
  );
}
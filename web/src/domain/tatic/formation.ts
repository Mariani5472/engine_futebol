import type { DetailedPosition } from "@/domain/player/overall";
import type { PlayerId } from "@/domain/team/types";
import type {
  Formation,
  TacticalPosition,
} from "./types";

export const FORMATIONS: Formation[] = [
  "4-3-3",
  "4-4-2",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
  "5-3-2",
];

type FormationRow = {
  positions: DetailedPosition[];
};

const FORMATION_ROWS: Record<
  Formation,
  FormationRow[]
> = {
  "4-3-3": [
    {
      positions: ["DL", "DC", "DC", "DR"],
    },
    {
      positions: ["CM", "CM", "CM"],
    },
    {
      positions: ["LW", "ST", "RW"],
    },
  ],

  "4-4-2": [
    {
      positions: ["DL", "DC", "DC", "DR"],
    },
    {
      positions: ["ML", "CM", "CM", "MR"],
    },
    {
      positions: ["ST", "ST"],
    },
  ],

  "4-2-3-1": [
    {
      positions: ["DL", "DC", "DC", "DR"],
    },
    {
      positions: ["DM", "DM"],
    },
    {
      positions: ["ML", "AM", "MR"],
    },
    {
      positions: ["ST"],
    },
  ],

  "3-5-2": [
    {
      positions: ["DC", "DC", "DC"],
    },
    {
      positions: [
        "ML",
        "CM",
        "DM",
        "CM",
        "MR",
      ],
    },
    {
      positions: ["ST", "ST"],
    },
  ],

  "3-4-3": [
    {
      positions: ["DC", "DC", "DC"],
    },
    {
      positions: ["ML", "CM", "CM", "MR"],
    },
    {
      positions: ["LW", "ST", "RW"],
    },
  ],

  "5-3-2": [
    {
      positions: [
        "DL",
        "DC",
        "DC",
        "DC",
        "DR",
      ],
    },
    {
      positions: ["CM", "CM", "CM"],
    },
    {
      positions: ["ST", "ST"],
    },
  ],
};

function rowPositions(
  count: number,
  y: number,
): Array<{ x: number; y: number }> {
  if (count === 1) {
    return [{ x: 50, y }];
  }

  return Array.from(
    { length: count },
    (_, index) => ({
      x:
        10 +
        (80 / (count - 1)) * index,
      y,
    }),
  );
}

export function createFormationPositions(
  formation: Formation,
  playerIds: PlayerId[],
): TacticalPosition[] {
  if (playerIds.length !== 11) {
    return [];
  }

  const rows = FORMATION_ROWS[formation];

  const totalOutfieldPlayers = rows.reduce(
    (total, row) =>
      total + row.positions.length,
    0,
  );

  if (totalOutfieldPlayers !== 10) {
    return [];
  }

  const positions: TacticalPosition[] = [
    {
      playerId: playerIds[0],
      position: "GK",
      x: 50,
      y: 92,
    },
  ];

  let playerIndex = 1;

  rows.forEach((row, rowIndex) => {
    const y =
      76 -
      rowIndex *
      (56 /
        Math.max(
          rows.length - 1,
          1,
        ));

    const coordinates = rowPositions(
      row.positions.length,
      y,
    );

    coordinates.forEach(
      (coordinate, index) => {
        positions.push({
          playerId:
            playerIds[playerIndex],
          position:
            row.positions[index],
          x: coordinate.x,
          y: coordinate.y,
        });

        playerIndex += 1;
      },
    );
  });

  return positions;
}

export function getFormationPositions(
  formation: Formation,
): DetailedPosition[] {
  return [
    "GK",
    ...FORMATION_ROWS[formation].flatMap(
      (row) => row.positions,
    ),
  ];
}
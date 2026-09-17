import type { PlayerId } from "@/domain/team/types";
import type { Formation, TacticalPosition } from "./types";

export const FORMATIONS: Formation[] = [
  "4-3-3",
  "4-4-2",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
  "5-3-2",
];

const FORMATION_ROWS: Record<Formation, number[]> = {
  "4-3-3": [4, 3, 3],
  "4-4-2": [4, 4, 2],
  "4-2-3-1": [4, 2, 3, 1],
  "3-5-2": [3, 5, 2],
  "3-4-3": [3, 4, 3],
  "5-3-2": [5, 3, 2],
};

function rowPositions(count: number, y: number): Array<{ x: number; y: number }> {
  if (count === 1) return [{ x: 50, y }];

  return Array.from({ length: count }, (_, index) => ({
    x: 10 + (80 / (count - 1)) * index,
    y,
  }));
}

export function createFormationPositions(
  formation: Formation,
  playerIds: PlayerId[],
): TacticalPosition[] {
  if (playerIds.length !== 11) return [];

  const positions: TacticalPosition[] = [
    { playerId: playerIds[0], x: 50, y: 92 },
  ];

  const rows = FORMATION_ROWS[formation];
  let playerIndex = 1;

  rows.forEach((count, rowIndex) => {
    const y = 76 - rowIndex * (56 / Math.max(rows.length - 1, 1));
    const row = rowPositions(count, y);

    row.forEach((position) => {
      positions.push({
        playerId: playerIds[playerIndex],
        x: position.x,
        y: position.y,
      });
      playerIndex += 1;
    });
  });

  return positions;
}

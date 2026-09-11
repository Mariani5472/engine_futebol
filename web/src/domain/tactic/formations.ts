import type { Formation, TacticalPosition } from "@/context/GameState";

export const FORMATIONS: Record<Formation, TacticalPosition[]> = {
  "4-3-3": [
    { playerId: "", x: 50, y: 91 }, { playerId: "", x: 12, y: 73 }, { playerId: "", x: 38, y: 77 }, { playerId: "", x: 62, y: 77 }, { playerId: "", x: 88, y: 73 },
    { playerId: "", x: 25, y: 57 }, { playerId: "", x: 50, y: 62 }, { playerId: "", x: 75, y: 57 }, { playerId: "", x: 18, y: 31 }, { playerId: "", x: 50, y: 23 }, { playerId: "", x: 82, y: 31 },
  ],
  "4-4-2": [
    { playerId: "", x: 50, y: 91 }, { playerId: "", x: 12, y: 73 }, { playerId: "", x: 38, y: 77 }, { playerId: "", x: 62, y: 77 }, { playerId: "", x: 88, y: 73 },
    { playerId: "", x: 12, y: 53 }, { playerId: "", x: 38, y: 58 }, { playerId: "", x: 62, y: 58 }, { playerId: "", x: 88, y: 53 }, { playerId: "", x: 38, y: 27 }, { playerId: "", x: 62, y: 27 },
  ],
  "4-2-3-1": [
    { playerId: "", x: 50, y: 91 }, { playerId: "", x: 12, y: 73 }, { playerId: "", x: 38, y: 77 }, { playerId: "", x: 62, y: 77 }, { playerId: "", x: 88, y: 73 },
    { playerId: "", x: 37, y: 61 }, { playerId: "", x: 63, y: 61 }, { playerId: "", x: 18, y: 40 }, { playerId: "", x: 50, y: 37 }, { playerId: "", x: 82, y: 40 }, { playerId: "", x: 50, y: 18 },
  ],
  "3-5-2": [
    { playerId: "", x: 50, y: 91 }, { playerId: "", x: 25, y: 75 }, { playerId: "", x: 50, y: 79 }, { playerId: "", x: 75, y: 75 }, { playerId: "", x: 10, y: 55 },
    { playerId: "", x: 30, y: 59 }, { playerId: "", x: 50, y: 57 }, { playerId: "", x: 70, y: 59 }, { playerId: "", x: 90, y: 55 }, { playerId: "", x: 38, y: 25 }, { playerId: "", x: 62, y: 25 },
  ],
  "3-4-3": [
    { playerId: "", x: 50, y: 91 }, { playerId: "", x: 25, y: 75 }, { playerId: "", x: 50, y: 79 }, { playerId: "", x: 75, y: 75 }, { playerId: "", x: 18, y: 55 },
    { playerId: "", x: 38, y: 59 }, { playerId: "", x: 62, y: 59 }, { playerId: "", x: 82, y: 55 }, { playerId: "", x: 18, y: 29 }, { playerId: "", x: 50, y: 22 }, { playerId: "", x: 82, y: 29 },
  ],
  "5-3-2": [
    { playerId: "", x: 50, y: 91 }, { playerId: "", x: 8, y: 72 }, { playerId: "", x: 29, y: 77 }, { playerId: "", x: 50, y: 79 }, { playerId: "", x: 71, y: 77 }, { playerId: "", x: 92, y: 72 },
    { playerId: "", x: 28, y: 56 }, { playerId: "", x: 50, y: 59 }, { playerId: "", x: 72, y: 56 }, { playerId: "", x: 38, y: 27 }, { playerId: "", x: 62, y: 27 },
  ],
};

export function createFormationPositions(formation: Formation, starters: string[]): TacticalPosition[] {
  return FORMATIONS[formation].map((position, index) => ({ ...position, playerId: starters[index] ?? "" }));
}

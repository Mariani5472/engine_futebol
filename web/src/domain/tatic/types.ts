import type { DetailedPosition } from "@/domain/player/overall";
import type { PlayerId } from "@/domain/team/types";

export type Formation =
  | "4-3-3"
  | "4-4-2"
  | "4-2-3-1"
  | "3-5-2"
  | "3-4-3"
  | "5-3-2";

export interface TacticalPosition {
  playerId: PlayerId;
  position: DetailedPosition;
  x: number;
  y: number;
}
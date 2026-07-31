import type { PlayerMatchState } from "../PlayerMatchState";

/** Ranked physical candidate for one authoritative possession transition. */
export interface PossessionCandidate {
  readonly player: PlayerMatchState;
  readonly distance: number;
  readonly score: number;
}

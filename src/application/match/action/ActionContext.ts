import { Pitch } from "../../../domain";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { Decision } from "../decision/Decision";
import { Random } from "../../../core/random/Random";

export interface ActionContext {
  readonly player: PlayerMatchState;
  readonly decision: Decision;
  readonly match: MatchState;
  readonly pitch: Pitch;
  readonly random: Random;
  readonly tick: number;
  readonly deltaTime: number;
  /** "HOME" | "AWAY" — side of the acting player. */
  readonly teamSide: "HOME" | "AWAY";
  /** 1 if team attacks toward x = pitch.length, -1 toward x = 0. */
  readonly attackingDirection: 1 | -1;
  /** Elapsed match seconds — used for event timestamps. */
  readonly matchSecond: number;
}

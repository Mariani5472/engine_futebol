import { PlayerMatchState } from "../../../domain";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { PlayerPerception } from "../perception/PlayerPerception";
export interface CognitiveContext {
  readonly player: PlayerMatchState;
  readonly awareness: PlayerAwareness;
  readonly perception: PlayerPerception;
  readonly deltaTime: number;
  readonly tick: number;
}
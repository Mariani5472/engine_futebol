import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { MatchState } from "../../../domain";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";

export class DecisionContext {
  constructor(
    public readonly match: MatchState,
    public readonly player: PlayerMatchState,
    public readonly awareness: PlayerAwareness,
    public readonly currentTick: number,
    public readonly deltaTime: number
  ) {}
}
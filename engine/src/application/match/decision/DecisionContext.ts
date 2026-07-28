import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { WorldAwareness } from "../awareness/WorldAwareness";

export class DecisionContext {
  constructor(
    public readonly match: MatchState,
    public readonly player: PlayerMatchState,
    public readonly awareness: PlayerAwareness,
    public readonly currentTick: number,
    public readonly deltaTime: number,
    /** Pre-computed tactical snapshot — evaluators should prefer this over scanning the pitch. */
    public readonly world: WorldAwareness,
  ) {}
}

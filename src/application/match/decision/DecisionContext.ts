import { PlayerMatchState } from "../../../domain";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { CognitiveContext } from "../cognitive/CognitiveContext";

export class DecisionContext {
  constructor(
    public readonly player: PlayerMatchState,
    public readonly awareness: PlayerAwareness,
    public readonly cognitive: CognitiveContext,
    public readonly currentTick: number,
    public readonly deltaTime: number
  ) {}
}
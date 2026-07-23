import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { DecisionType } from "../DecisionType";
export interface PersonalityContext {
  readonly player: PlayerMatchState;
  readonly decisionType: DecisionType;
}
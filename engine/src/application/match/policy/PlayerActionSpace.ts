import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";

export const PLAYER_ACTION_SPACE_VERSION = 1 as const;

export const PLAYER_ACTION_IDS = [
  "NONE", "PASS", "CROSS", "SHOT", "DRIBBLE", "HOLD_BALL", "CLEAR",
  "RECEIVE", "HEADER", "CONTROL", "SKILL_MOVE", "MOVE", "MARK", "COVER",
  "PRESS", "INTERCEPT", "TACKLE", "BLOCK", "POSITION", "SET_PIECE",
  "GK_CLAIM", "GK_DISTRIBUTE", "FAKE", "TACTICAL_FOUL",
] as const;

export type PlayerActionId = typeof PLAYER_ACTION_IDS[number];
export type ActionMaskBit = 0 | 1;

export interface DiscretePlayerAction {
  readonly id: PlayerActionId;
  readonly index: number;
  readonly decisionType: DecisionType;
}

export interface PlayerActionMaskEntry extends DiscretePlayerAction {
  readonly enabled: boolean;
  /** Null denotes the targetless variant of an action. */
  readonly validTargetIds: readonly (string | null)[];
}

export interface PlayerActionMask {
  readonly version: typeof PLAYER_ACTION_SPACE_VERSION;
  readonly playerId: string;
  readonly matchSecond: number;
  readonly bits: readonly ActionMaskBit[];
  readonly entries: readonly PlayerActionMaskEntry[];
}

const ACTIONS: readonly DiscretePlayerAction[] = Object.freeze(
  PLAYER_ACTION_IDS.map((id, index) => Object.freeze({
    id,
    index,
    decisionType: DecisionType[id],
  })),
);

const BY_TYPE = new Map(ACTIONS.map(action => [action.decisionType, action]));
const BY_ID = new Map(ACTIONS.map(action => [action.id, action]));

export class PlayerActionSpace {
  public readonly version = PLAYER_ACTION_SPACE_VERSION;
  public readonly actions = ACTIONS;

  public mask(
    playerId: string,
    matchSecond: number,
    validDecisions: readonly Decision[],
  ): PlayerActionMask {
    const entries = this.actions.map(action => {
      const matching = validDecisions.filter(decision => decision.type === action.decisionType);
      const validTargetIds = [...new Set(matching.map(decision => decision.targetId ?? null))];
      return Object.freeze({ ...action, enabled: matching.length > 0, validTargetIds });
    });
    return Object.freeze({
      version: this.version,
      playerId,
      matchSecond,
      bits: Object.freeze(entries.map(entry => entry.enabled ? 1 as const : 0 as const)),
      entries: Object.freeze(entries),
    });
  }

  /** Resolves to the exact canonical decision represented by the mask. */
  public resolve(requested: Decision, validDecisions: readonly Decision[]): Decision | undefined {
    return validDecisions.find(candidate => candidate.type === requested.type
      && candidate.targetId === requested.targetId);
  }

  public actionForType(type: DecisionType): DiscretePlayerAction {
    const action = BY_TYPE.get(type);
    if (!action) throw new Error(`DecisionType ${type} is outside player action space v${this.version}`);
    return action;
  }

  public actionForId(id: string): DiscretePlayerAction {
    const action = BY_ID.get(id as PlayerActionId);
    if (!action) throw new Error(`Unknown player action id: ${id}`);
    return action;
  }
}

export const PLAYER_ACTION_SPACE = Object.freeze(new PlayerActionSpace());

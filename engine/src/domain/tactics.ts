import { Vector2 } from "./common";
import { PlayerPosition, PlayerRole } from "./player";

export type TacticalPhase =
  | "DEFENDING"
  | "TRANSITION_TO_ATTACK"
  | "ATTACKING"
  | "TRANSITION_TO_DEFENSE";

export type TeamInstructionKey =
  | "HIGH_PRESS"
  | "LOW_BLOCK"
  | "COUNTER_ATTACK"
  | "POSSESSION"
  | "DIRECT_PLAY"
  | "WIDE_PLAY"
  | "NARROW_PLAY";

export type PlayerInstructionKey =
  | "HOLD_POSITION"
  | "ROAM_FROM_POSITION"
  | "STAY_WIDER"
  | "CUT_INSIDE"
  | "PRESS_MORE"
  | "TAKE_MORE_RISKS"
  | "RISK_AVERSE"
  | "DROP_DEEP";

export interface TacticalShapeAssignment {
  readonly id: string;
  readonly position: PlayerPosition;
  readonly role: PlayerRole;
  readonly defensiveAnchor: Vector2;
  readonly attackingAnchor: Vector2;
  readonly width: number;
  readonly depth: number;
  readonly freedom: number;
}

export interface TacticalShape {
  readonly name: string;
  readonly assignments: readonly TacticalShapeAssignment[];
}

export interface TeamTacticalInstructions {
  readonly instructions: readonly TeamInstructionKey[];
}

export interface PlayerTacticalInstructions {
  readonly playerId: string;
  readonly instructions: readonly PlayerInstructionKey[];
}

export interface TacticProps {
  readonly defensiveShape: TacticalShape;
  readonly attackingShape: TacticalShape;
  readonly teamInstructions: TeamTacticalInstructions;
  readonly playerInstructions: readonly PlayerTacticalInstructions[];
  readonly familiarity: number; // 0-100
}

export class Tactic {
  public readonly defensiveShape: TacticalShape;
  public readonly attackingShape: TacticalShape;
  public readonly teamInstructions: TeamTacticalInstructions;
  public readonly playerInstructions: readonly PlayerTacticalInstructions[];
  public readonly familiarity: number;

  private constructor(props: TacticProps) {
    this.defensiveShape = props.defensiveShape;
    this.attackingShape = props.attackingShape;
    this.teamInstructions = props.teamInstructions;
    this.playerInstructions = props.playerInstructions;
    this.familiarity = props.familiarity;
  }

  public static create(props: TacticProps): Tactic {
    if (!props.defensiveShape.assignments.length) {
      throw new Error("Defensive shape must have at least one assignment.");
    }

    if (!props.attackingShape.assignments.length) {
      throw new Error("Attacking shape must have at least one assignment.");
    }

    if (props.familiarity < 0 || props.familiarity > 100) {
      throw new Error("Tactic familiarity must be between 0 and 100.");
    }

    return new Tactic(props);
  }
}
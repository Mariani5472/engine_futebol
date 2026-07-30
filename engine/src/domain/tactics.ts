import { Vector2 } from "./common";
import { PlayerPosition, PlayerRole } from "./player";

export type TacticalPhase =
  | "DEFENSIVE_BLOCK"
  | "DEFENSIVE_TRANSITION"
  | "BUILD_UP"
  | "PROGRESSION"
  | "FINAL_THIRD"
  | "ATTACKING_TRANSITION"
  | "COUNTER_ATTACK"
  | "SET_PIECE";

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

export type TacticalTempo = "LOW" | "NORMAL" | "HIGH";
export type TacticalWidth = "NARROW" | "BALANCED" | "WIDE";
export type PassingStyle = "SHORTER" | "BALANCED" | "DIRECT";
export type AttackFocus = "LEFT" | "CENTRE" | "RIGHT";
export type DefensiveLineHeight = "LOW" | "STANDARD" | "HIGH";
export type PressLineHeight = "LOW" | "MID" | "HIGH";
export type PressingIntensity = "LOW" | "NORMAL" | "HIGH";
export type DefensiveBlock = "LOW" | "MID" | "HIGH";
export type PressingDirection = "INSIDE" | "OUTSIDE" | "NONE";
export type GoalkeeperDistribution = "SHORT" | "FULL_BACKS" | "CENTRE_BACKS" | "DIRECT" | "MIXED";
export type TacticalZone = "LEFT" | "CENTRE" | "RIGHT" | "OWN_THIRD" | "MIDDLE_THIRD" | "FINAL_THIRD";

export interface InPossessionInstructions {
  readonly tempo: TacticalTempo;
  readonly width: TacticalWidth;
  readonly passingStyle: PassingStyle;
  readonly playOutOfDefence: boolean;
  readonly focus: readonly AttackFocus[];
  readonly overlapLeft: boolean;
  readonly overlapRight: boolean;
  readonly workBallIntoBox: boolean;
  readonly earlyCrosses: boolean;
  readonly creativeFreedom: "DISCIPLINED" | "BALANCED" | "EXPRESSIVE";
}

export interface OutOfPossessionInstructions {
  readonly defensiveLine: DefensiveLineHeight;
  readonly pressLine: PressLineHeight;
  readonly intensity: PressingIntensity;
  readonly block: DefensiveBlock;
  readonly tightMarking: boolean;
  readonly preventShortDistribution: boolean;
  readonly showDirection: PressingDirection;
}

export interface TransitionInstructions {
  readonly counterPress: boolean;
  readonly regroup: boolean;
  readonly counterAttack: boolean;
  readonly holdShape: boolean;
  readonly goalkeeperDistribution: GoalkeeperDistribution;
}

export interface OppositionPlayerInstruction {
  readonly opponentPlayerId: string;
  readonly press: boolean;
  readonly tightMark: boolean;
  readonly forceWeakFoot: boolean;
  readonly markWithPlayerId?: string;
  readonly doubleMark: boolean;
}

export interface OppositionInstructions {
  readonly players: readonly OppositionPlayerInstruction[];
  readonly allowedZones: readonly TacticalZone[];
  readonly blockedZones: readonly TacticalZone[];
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
  readonly inPossession?: Partial<InPossessionInstructions>;
  readonly outOfPossession?: Partial<OutOfPossessionInstructions>;
  readonly transition?: Partial<TransitionInstructions>;
  readonly opposition?: Partial<OppositionInstructions>;
}

export class Tactic {
  public readonly defensiveShape: TacticalShape;
  public readonly attackingShape: TacticalShape;
  public readonly teamInstructions: TeamTacticalInstructions;
  public readonly playerInstructions: readonly PlayerTacticalInstructions[];
  public readonly familiarity: number;
  public readonly inPossession: InPossessionInstructions;
  public readonly outOfPossession: OutOfPossessionInstructions;
  public readonly transition: TransitionInstructions;
  public readonly opposition: OppositionInstructions;

  private constructor(props: TacticProps) {
    this.defensiveShape = props.defensiveShape;
    this.attackingShape = props.attackingShape;
    this.teamInstructions = props.teamInstructions;
    this.playerInstructions = props.playerInstructions;
    this.familiarity = props.familiarity;
    this.inPossession = { ...DEFAULT_IN_POSSESSION, ...props.inPossession };
    this.outOfPossession = { ...DEFAULT_OUT_OF_POSSESSION, ...props.outOfPossession };
    this.transition = { ...DEFAULT_TRANSITION, ...props.transition };
    this.opposition = {
      players: props.opposition?.players ?? [],
      allowedZones: props.opposition?.allowedZones ?? [],
      blockedZones: props.opposition?.blockedZones ?? [],
    };
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

const DEFAULT_IN_POSSESSION: InPossessionInstructions = {
  tempo: "NORMAL", width: "BALANCED", passingStyle: "BALANCED", playOutOfDefence: false,
  focus: [], overlapLeft: false, overlapRight: false, workBallIntoBox: false,
  earlyCrosses: false, creativeFreedom: "BALANCED",
};
const DEFAULT_OUT_OF_POSSESSION: OutOfPossessionInstructions = {
  defensiveLine: "STANDARD", pressLine: "MID", intensity: "NORMAL", block: "MID",
  tightMarking: false, preventShortDistribution: false, showDirection: "NONE",
};
const DEFAULT_TRANSITION: TransitionInstructions = {
  counterPress: true, regroup: false, counterAttack: false, holdShape: false,
  goalkeeperDistribution: "MIXED",
};

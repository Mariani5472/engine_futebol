import {
  TacticalSetup,
} from "./TacticalSetup";
import {
  TacticalPhase,
  TacticalRole,
} from "./RoleAttributeMapping";
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
export interface TeamTacticalInstructions {
  readonly instructions:
  readonly TeamInstructionKey[];
}
export interface PlayerTacticalInstructions {
  readonly playerId:
  string;
  readonly instructions:
  readonly PlayerInstructionKey[];
}
export interface TacticProps {
  readonly setup:
  TacticalSetup;
  readonly teamInstructions:
  TeamTacticalInstructions;
  readonly playerInstructions:
  readonly PlayerTacticalInstructions[];
  readonly familiarity:
  number;
}
export class Tactic {
  public readonly setup:
    TacticalSetup;
  public readonly teamInstructions:
    TeamTacticalInstructions;
  public readonly playerInstructions:
    readonly PlayerTacticalInstructions[];
  public readonly familiarity:
    number;
  private constructor(
    props: TacticProps
  ) {
    this.setup =
      props.setup;
    this.teamInstructions =
      props.teamInstructions;
    this.playerInstructions =
      Object.freeze([
        ...props.playerInstructions,
      ]);
    this.familiarity =
      props.familiarity;
  }
  public static create(
    props: TacticProps
  ): Tactic {
    if (
      props.familiarity < 0 ||
      props.familiarity > 100
    ) {
      throw new Error(
        "Tactic familiarity must be between 0 and 100."
      );
    }
    return new Tactic(
      props
    );
  }
  public getRoleForPlayer(
    phase: TacticalPhase,
    playerId: string
  ):
    TacticalRole | undefined {
    const assignment =
      phase === "IN_POSSESSION"
        ? this.setup.inPossession.assignments
        : this.setup.outOfPossession.assignments;
    return assignment.find(
      item =>
        item.playerId === playerId
    )?.role;
  }
}
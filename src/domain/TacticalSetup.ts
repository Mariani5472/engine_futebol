import {
  PlayerId,
} from "./common";
import {
  TacticalPosition,
} from "./TacticalPositions";
import {
  TacticalPhase,
  TacticalRole,
} from "./RoleAttributeMapping";
import {
  FormationValidator,
} from "./FormationValidator";
import {
  RoleCompatibilityValidator,
} from "./RoleCompatibilityValidator";
export interface TacticalAssignment {
  readonly playerId:
  PlayerId;
  readonly position:
  TacticalPosition;
  readonly role:
  TacticalRole;
}
export interface TacticalPhaseSetup {
  readonly phase:
  TacticalPhase;
  readonly assignments:
  readonly TacticalAssignment[];
}
export interface TacticalSetupProps {
  readonly inPossession:
  TacticalPhaseSetup;
  readonly outOfPossession:
  TacticalPhaseSetup;
}
export class TacticalSetup {
  public readonly inPossession:
    TacticalPhaseSetup;
  public readonly outOfPossession:
    TacticalPhaseSetup;
  private constructor(
    props: TacticalSetupProps
  ) {
    this.inPossession =
      Object.freeze({
        ...props.inPossession,
        assignments:
          Object.freeze([
            ...props.inPossession.assignments,
          ]),
      });
    this.outOfPossession =
      Object.freeze({
        ...props.outOfPossession,
        assignments:
          Object.freeze([
            ...props.outOfPossession.assignments,
          ]),
      });
  }
  public static create(
    props: TacticalSetupProps
  ): TacticalSetup {
    this.validatePhase(
      props.inPossession,
      "IN_POSSESSION"
    );
    this.validatePhase(
      props.outOfPossession,
      "OUT_OF_POSSESSION"
    );
    this.validateSamePlayers(
      props.inPossession,
      props.outOfPossession
    );
    return new TacticalSetup(
      props
    );
  }
  public getAssignment(
    phase: TacticalPhase,
    playerId: PlayerId
  ):
    TacticalAssignment | undefined {
    const setup =
      phase === "IN_POSSESSION"
        ? this.inPossession
        : this.outOfPossession;
    return setup.assignments.find(
      assignment =>
        assignment.playerId === playerId
    );
  }
  private static validatePhase(
    setup: TacticalPhaseSetup,
    expectedPhase: TacticalPhase
  ): void {
    if (
      setup.phase !== expectedPhase
    ) {
      throw new Error(
        `Expected phase ${expectedPhase}, ` +
        `received ${setup.phase}.`
      );
    }
    const assignments =
      setup.assignments;
    FormationValidator.assertValid(
      assignments.map(
        assignment =>
          assignment.position
      )
    );
    const playerIds =
      new Set<PlayerId>();
    for (
      const assignment
      of assignments
    ) {
      if (
        playerIds.has(
          assignment.playerId
        )
      ) {
        throw new Error(
          `Player ${String(assignment.playerId)} ` +
          `appears more than once in ${expectedPhase}.`
        );
      }
      playerIds.add(
        assignment.playerId
      );
      RoleCompatibilityValidator.assertCompatible(
        assignment.position,
        assignment.role,
        expectedPhase
      );
    }
  }
  private static validateSamePlayers(
    inPossession: TacticalPhaseSetup,
    outOfPossession: TacticalPhaseSetup
  ): void {
    const inPlayers =
      new Set(
        inPossession.assignments.map(
          assignment =>
            assignment.playerId
        )
      );
    const outPlayers =
      new Set(
        outOfPossession.assignments.map(
          assignment =>
            assignment.playerId
        )
      );
    if (
      inPlayers.size !==
      outPlayers.size
    ) {
      throw new Error(
        "In-possession and out-of-possession " +
        "setups must contain the same 11 players."
      );
    }
    for (
      const playerId
      of inPlayers
    ) {
      if (
        !outPlayers.has(
          playerId
        )
      ) {
        throw new Error(
          "Both tactical phases must contain " +
          "the same players."
        );
      }
    }
  }
}
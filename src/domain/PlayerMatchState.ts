import { createVector2, PlayerId, Vector2 } from "./common";
import { PlayerRole } from "./PlayerBase";
import { TacticalPosition } from "./TacticalPositions";


export type InjuryStatus =
  | "HEALTHY"
  | "MINOR"
  | "MAJOR";

export type SuspensionStatus =
  | "ELIGIBLE"
  | "SUSPENDED";

export type BodyOrientation =
  | "NORTH"
  | "NORTH_EAST"
  | "EAST"
  | "SOUTH_EAST"
  | "SOUTH"
  | "SOUTH_WEST"
  | "WEST"
  | "NORTH_WEST";

export interface PlayerMatchStateProps {

  readonly playerId: PlayerId;

  readonly position: Vector2;

  readonly velocity: Vector2;

  readonly tacticalPosition:
  TacticalPosition;

  readonly currentRole:
  PlayerRole;

  readonly fatigue: number;

  readonly condition: number;

  readonly fitness: number;

  readonly injuryStatus:
  InjuryStatus;

  readonly suspensionStatus:
  SuspensionStatus;

  readonly currentStamina: number;

  readonly bodyOrientation:
  BodyOrientation;
}

export class PlayerMatchState {

  public readonly playerId:
    PlayerId;

  public position:
    Vector2;

  public velocity:
    Vector2;

  public tacticalPosition:
    TacticalPosition;

  public currentRole:
    PlayerRole;

  public fatigue:
    number;

  public condition:
    number;

  public fitness:
    number;

  public injuryStatus:
    InjuryStatus;

  public suspensionStatus:
    SuspensionStatus;

  public currentStamina:
    number;

  public bodyOrientation:
    BodyOrientation;

  private constructor(
    props: PlayerMatchStateProps
  ) {

    this.playerId =
      props.playerId;

    this.position =
      createVector2(
        props.position.x,
        props.position.y
      );

    this.velocity =
      createVector2(
        props.velocity.x,
        props.velocity.y
      );

    this.tacticalPosition =
      props.tacticalPosition;

    this.currentRole =
      props.currentRole;

    this.fatigue =
      props.fatigue;

    this.condition =
      props.condition;

    this.fitness =
      props.fitness;

    this.injuryStatus =
      props.injuryStatus;

    this.suspensionStatus =
      props.suspensionStatus;

    this.currentStamina =
      props.currentStamina;

    this.bodyOrientation =
      props.bodyOrientation;
  }

  public static create(
    props: PlayerMatchStateProps
  ): PlayerMatchState {

    this.validatePercentage(
      props.fatigue,
      "fatigue"
    );

    this.validatePercentage(
      props.condition,
      "condition"
    );

    this.validatePercentage(
      props.fitness,
      "fitness"
    );

    this.validatePercentage(
      props.currentStamina,
      "currentStamina"
    );

    return new PlayerMatchState(
      props
    );
  }

  public setPosition(
    position: Vector2
  ): void {

    this.position =
      createVector2(
        position.x,
        position.y
      );
  }

  public setVelocity(
    velocity: Vector2
  ): void {

    this.velocity =
      createVector2(
        velocity.x,
        velocity.y
      );
  }

  public setTacticalPosition(
    position: TacticalPosition
  ): void {

    this.tacticalPosition =
      position;
  }

  public setRole(
    role: PlayerRole
  ): void {

    this.currentRole =
      role;
  }

  public updateFatigue(
    fatigue: number
  ): void {

    this.fatigue =
      PlayerMatchState.clampPercentage(
        fatigue
      );
  }

  public updateCondition(
    condition: number
  ): void {

    this.condition =
      PlayerMatchState.clampPercentage(
        condition
      );
  }

  public updateFitness(
    fitness: number
  ): void {

    this.fitness =
      PlayerMatchState.clampPercentage(
        fitness
      );
  }

  public updateStamina(
    stamina: number
  ): void {

    this.currentStamina =
      PlayerMatchState.clampPercentage(
        stamina
      );
  }

  public applyInjury(
    status: InjuryStatus
  ): void {

    this.injuryStatus =
      status;
  }

  public suspend(): void {

    this.suspensionStatus =
      "SUSPENDED";
  }

  public clearSuspension(): void {

    this.suspensionStatus =
      "ELIGIBLE";
  }

  private static validatePercentage(
    value: number,
    name: string
  ): void {

    if (
      !Number.isFinite(value) ||
      value < 0 ||
      value > 100
    ) {
      throw new Error(
        `${name} must be between 0 and 100.`
      );
    }
  }

  private static clampPercentage(
    value: number
  ): number {

    return Math.max(
      0,
      Math.min(
        100,
        value
      )
    );
  }
}
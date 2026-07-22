import {
  PlayerBase,
  PlayerRole,
} from "../../domain/PlayerBase";

import {
  Vector2,
  createVector2,
} from "../../domain/common";

export type InjuryStatus =
  | "HEALTHY"
  | "MINOR_INJURY"
  | "MAJOR_INJURY";

export type SuspensionStatus =
  | "AVAILABLE"
  | "SUSPENDED";

export type BodyOrientation =
  | Vector2;

export interface PlayerMatchStateProps {
  readonly position: Vector2;
  readonly velocity?: Vector2;
  readonly fatigue?: number;
  readonly condition?: number;
  readonly fitness?: number;
  readonly injuryStatus?: InjuryStatus;
  readonly suspensionStatus?: SuspensionStatus;
  readonly currentStamina?: number;
  readonly bodyOrientation?: Vector2;
  readonly hasBall?: boolean;
  readonly currentRole: PlayerRole;
  readonly targetPosition?: Vector2;
}

export class PlayerMatchState {
  public readonly player: PlayerBase;
  public position: Vector2;
  public velocity: Vector2;
  public fatigue: number;
  public condition: number;
  public fitness: number;
  public injuryStatus: InjuryStatus;
  public suspensionStatus: SuspensionStatus;
  public currentStamina: number;
  public bodyOrientation: BodyOrientation;
  public hasBall: boolean;
  public currentRole: PlayerRole;
  public targetPosition: Vector2;
  private constructor(player: PlayerBase, props: PlayerMatchStateProps) {
    this.player = player;

    this.position = createVector2(
      props.position.x,
      props.position.y
    );

    this.velocity = createVector2(
      props.velocity?.x ?? 0,
      props.velocity?.y ?? 0
    );

    this.fatigue = PlayerMatchState.normalizePercentage(
      props.fatigue ?? 0
    );

    this.condition = PlayerMatchState.normalizePercentage(
      props.condition ?? 100
    );

    this.fitness = PlayerMatchState.normalizePercentage(
      props.fitness ?? 100
    );

    this.injuryStatus = props.injuryStatus ?? "HEALTHY";
    this.suspensionStatus = props.suspensionStatus ?? "AVAILABLE";

    this.currentStamina = PlayerMatchState.normalizePercentage(
      props.currentStamina ?? 100
    );

    this.bodyOrientation = createVector2(
      props.bodyOrientation?.x ?? 1,
      props.bodyOrientation?.y ?? 0
    );

    this.hasBall = props.hasBall ?? false;

    this.currentRole = props.currentRole;

    this.targetPosition = createVector2(
      props.targetPosition?.x ?? props.position.x,
      props.targetPosition?.y ?? props.position.y
    );
  }

  public static create(
    player: PlayerBase,
    props: PlayerMatchStateProps
  ): PlayerMatchState {

    return new PlayerMatchState(player, props);
  }

  public setPosition(position: Vector2): void {
    this.position = createVector2(
      position.x,
      position.y
    );
  }

  public setVelocity(velocity: Vector2): void {
    this.velocity = createVector2(
      velocity.x,
      velocity.y
    );
  }

  public setTarget(position: Vector2): void {

    this.targetPosition = createVector2(
      position.x,
      position.y
    );
  }

  public setBodyOrientation(orientation: Vector2): void {
    this.bodyOrientation = createVector2(
      orientation.x,
      orientation.y
    );
  }

  public setFatigue(fatigue: number): void {
    this.fatigue = PlayerMatchState.normalizePercentage(
      fatigue
    );
  }

  public setCondition(condition: number): void {
    this.condition = PlayerMatchState.normalizePercentage(
      condition
    );
  }

  public setFitness(fitness: number): void {
    this.fitness = PlayerMatchState.normalizePercentage(
      fitness
    );
  }

  public setStamina(stamina: number): void {
    this.currentStamina = PlayerMatchState.normalizePercentage(
      stamina
    );
  }

  public setRole(role: PlayerRole): void {
    this.currentRole = role;
  }

  public giveBall(): void {
    this.hasBall = true;
  }

  public removeBall(): void {
    this.hasBall = false;
  }

  public injure(status: InjuryStatus): void {
    this.injuryStatus = status;
  }

  public suspend(): void {
    this.suspensionStatus = "SUSPENDED";
  }

  public clearSuspension(): void {
    this.suspensionStatus = "AVAILABLE";
  }

  public canPlay(): boolean {
    return (
      this.injuryStatus === "HEALTHY" &&
      this.suspensionStatus === "AVAILABLE"
    );
  }

  private static normalizePercentage(value: number): number {

    if (!Number.isFinite(value)) {
      throw new Error(`Percentage value must be finite. Received: ${value}`);
    }

    return Math.max(0, Math.min(100, value));
  }
}
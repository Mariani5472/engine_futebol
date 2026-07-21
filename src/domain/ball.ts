import { createVector2, Vector2 } from "./common";

export type BallStateType =
  | "FREE"
  | "CONTROLLED"
  | "PASSING"
  | "CROSSING"
  | "SHOOTING"
  | "DEFLECTED"
  | "LOOSE";

export interface BallState {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly height: number;
  readonly state: BallStateType;
  readonly ownerPlayerId: string | null;
}

export interface BallTrajectory {
  readonly origin: Vector2;
  readonly target: Vector2;
  readonly speed: number;
  readonly direction: Vector2;
}

export interface BallProps {
  readonly position: Vector2;
  readonly velocity: Vector2;
  readonly height: number;
  readonly state: BallStateType;
  readonly ownerPlayerId: string | null;
}

export class Ball {
  public readonly position: Vector2;
  public readonly velocity: Vector2;
  public readonly height: number;
  public readonly state: BallStateType;
  public readonly ownerPlayerId: string | null;

  private constructor(props: BallProps) {
    this.position = props.position;
    this.velocity = props.velocity;
    this.height = props.height;
    this.state = props.state;
    this.ownerPlayerId = props.ownerPlayerId;
  }

  public static create(props: BallProps): Ball {
    if (props.height < 0) {
      throw new Error("Ball height cannot be negative.");
    }

    return new Ball(props);
  }

  public static stationary(position: Vector2): Ball {
    return Ball.create({
      position: createVector2(position.x, position.y),
      velocity: createVector2(0, 0),
      height: 0,
      state: "FREE",
      ownerPlayerId: null,
    });
  }
}
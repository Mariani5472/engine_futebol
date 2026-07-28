import { Vector2 } from "../geometry/Vector2";
import { PlayerMatchState } from "./PlayerMatchState";

export enum BallState {
  CONTROLLED,
  FREE,
  IN_FLIGHT,
  DEFLECTED
}

export type BallMotionKind = "GROUND_PASS" | "AERIAL_PASS" | "CROSS" | "SHOT" | "DEFLECTION" | "CLEARANCE";

export interface BallMotion {
  readonly kind: BallMotionKind;
  readonly origin: Vector2;
  readonly target: Vector2;
  readonly duration: number;
  readonly peakHeight: number;
  readonly curve: number;
  readonly hasExplicitEffect: boolean;
  elapsed: number;
}

export class BallMatchState {

  public visualPosition: Vector2;
  public visualHeight: number;
  public visualVelocity: Vector2 = Vector2.zero();
  public motion: BallMotion | null = null;

  constructor(
    public position: Vector2,
    public velocity: Vector2,
    public owner: PlayerMatchState | null,
    public state: BallState,
    public height: number
  ) {
    this.visualPosition = position;
    this.visualHeight = height;
  }

  public startMotion(motion: Omit<BallMotion, "elapsed">): void {
    this.motion = { ...motion, elapsed: 0 };
    this.visualPosition = motion.origin;
    this.visualHeight = 0;
    this.visualVelocity = motion.target.subtract(motion.origin).divide(Math.max(.01, motion.duration));
  }

}

import { Vector2 } from "../../../core/geometry/Vector2";
import type { BallMatchState, BallMotionKind } from "../../../core/movement/BallMatchState";

export interface BallKickMotion {
  readonly kind: BallMotionKind;
  readonly origin: Vector2;
  readonly target: Vector2;
  readonly speed: number;
  readonly peakHeight?: number;
  readonly curve?: number;
  readonly hasExplicitEffect?: boolean;
  readonly intendedReceiverId?: string | null;
  readonly startHeight?: number;
  readonly targetHeight?: number;
}

/** Creates engine-owned visual physics from the exact action origin/target. */
export class BallMotionPlanner {
  public static start(ball: BallMatchState, kick: BallKickMotion): void {
    const distance = kick.origin.distanceTo(kick.target);
    ball.startMotion({
      kind: kick.kind,
      origin: kick.origin,
      target: kick.target,
      duration: Math.max(.16, Math.min(2.2, distance / Math.max(1, kick.speed))),
      peakHeight: Math.max(0, kick.peakHeight ?? 0),
      curve: kick.hasExplicitEffect ? (kick.curve ?? 0) : 0,
      hasExplicitEffect: kick.hasExplicitEffect === true,
      intendedReceiverId: kick.intendedReceiverId ?? null,
      startHeight: Math.max(0, kick.startHeight ?? 0),
      targetHeight: Math.max(0, kick.targetHeight ?? 0),
    });
  }
}

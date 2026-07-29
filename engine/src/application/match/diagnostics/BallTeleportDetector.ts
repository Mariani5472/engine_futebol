import { Vector2 } from "../../../core/geometry/Vector2";
import type { PossessionAcquisitionRecord } from "../../../core/movement/BallMatchState";

export interface BallTeleportViolation {
  readonly type: "BALL_TELEPORT";
  readonly seed: number;
  readonly matchSecond: number;
  readonly distance: number;
  readonly allowedDistance: number;
  readonly from: Vector2;
  readonly to: Vector2;
  readonly playerId: string | null;
  readonly reason: string;
}

export class BallTeleportDetector {
  public inspectTick(input: {
    seed: number; matchSecond: number; deltaTime: number;
    before: Vector2; after: Vector2; beforeSpeed: number; afterSpeed: number;
    physicsDisplacement?: number;
    acquisitions: readonly PossessionAcquisitionRecord[]; isRestart: boolean;
  }): BallTeleportViolation[] {
    if (input.isRestart) return [];
    const distance = input.before.distanceTo(input.after);
    // A curved/eased flight may accelerate inside the tick and an interception
    // may stop it before the sampled afterSpeed. One metre is a conservative
    // sub-tick envelope; ownership itself is still limited independently to 1.5m.
    const velocityEnvelope = Math.max(input.beforeSpeed, input.afterSpeed) * input.deltaTime;
    const physicalEnvelope = input.physicsDisplacement ?? 0;
    const allowedDistance = Math.max(velocityEnvelope, physicalEnvelope) + 1;
    if (distance <= allowedDistance) return [];
    const acquisition = input.acquisitions.at(-1);
    return [{
      type: "BALL_TELEPORT", seed: input.seed, matchSecond: input.matchSecond,
      distance, allowedDistance, from: input.before, to: input.after,
      playerId: acquisition?.playerId ?? null,
      reason: acquisition?.reason ?? "UNEXPLAINED_POSITION_JUMP",
    }];
  }

  public assertNoTeleport(violations: readonly BallTeleportViolation[]): void {
    if (!violations.length) return;
    const first = violations[0];
    throw new Error(`Ball teleport seed=${first.seed} second=${first.matchSecond.toFixed(2)} player=${first.playerId ?? "none"} distance=${first.distance.toFixed(2)}m allowed=${first.allowedDistance.toFixed(2)}m reason=${first.reason}`);
  }
}

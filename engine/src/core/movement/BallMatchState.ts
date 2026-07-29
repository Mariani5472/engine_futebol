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
  readonly intendedReceiverId: string | null;
  elapsed: number;
}

export type PossessionAcquisitionReason = "PASS_RESOLUTION" | "INTENDED_RECEPTION" | "INTERCEPTION" | "PHYSICAL_CLAIM" | "FALLBACK_CLAIM" | "EMERGENCY_RECLAIM" | "TACKLE" | "GOALKEEPER_SAVE" | "RESTART" | "DRIBBLE_RECOVERY";
export interface PossessionAcquisitionRecord {
  readonly type: "POSSESSION_CHANGED";
  readonly matchSecond: number;
  readonly playerId: string;
  readonly distanceToBall: number;
  readonly ballSpeed: number;
  readonly reason: PossessionAcquisitionReason;
  readonly previousAction: string | null;
  readonly ballPosition: Vector2;
  readonly playerPosition: Vector2;
}

export interface PendingPass {
  readonly passerId: string;
  readonly intendedReceiverId: string;
  readonly startedAtSecond: number;
  readonly realForwardGain: number;
}

export interface PassResolutionRecord {
  readonly type: "PASS_RESOLVED";
  readonly matchSecond: number;
  readonly passerId: string;
  readonly intendedReceiverId: string;
  readonly controllingPlayerId: string;
  readonly success: boolean;
  readonly realForwardGain: number;
}

export class BallMatchState {

  public visualPosition: Vector2;
  public visualHeight: number;
  public visualVelocity: Vector2 = Vector2.zero();
  public motion: BallMotion | null = null;
  public intendedReceiverId: string | null = null;
  public previousPosition: Vector2;
  public lastPhysicsDisplacement = 0;
  public controlOffset: Vector2 = Vector2.zero();
  public pendingPass: PendingPass | null = null;
  public lastTouchedPlayerId: string | null;
  private possessionAcquisitions: PossessionAcquisitionRecord[] = [];
  private passResolutions: PassResolutionRecord[] = [];

  constructor(
    public position: Vector2,
    public velocity: Vector2,
    public owner: PlayerMatchState | null,
    public state: BallState,
    public height: number
  ) {
    this.visualPosition = position;
    this.visualHeight = height;
    this.previousPosition = position;
    this.lastTouchedPlayerId = owner?.player.id ?? null;
  }

  public startMotion(motion: Omit<BallMotion, "elapsed">): void {
    this.release();
    this.motion = { ...motion, elapsed: 0 };
    this.intendedReceiverId = motion.intendedReceiverId;
    this.position = motion.origin;
    this.previousPosition = motion.origin;
    this.velocity = motion.target.subtract(motion.origin).divide(Math.max(.01, motion.duration));
    this.height = 0;
    this.state = BallState.IN_FLIGHT;
    this.visualPosition = motion.origin;
    this.visualHeight = 0;
    this.visualVelocity = motion.target.subtract(motion.origin).divide(Math.max(.01, motion.duration));
  }

  public acquirePossession(player: PlayerMatchState, reason: PossessionAcquisitionReason, matchSecond: number): void {
    if (this.owner !== player) {
      this.possessionAcquisitions.push({
        type: "POSSESSION_CHANGED", matchSecond, playerId: player.player.id,
        distanceToBall: player.position.distanceTo(this.position),
        ballSpeed: Math.max(this.velocity.magnitude(), this.visualVelocity.magnitude()),
        reason, previousAction: player.lastActionType === undefined ? null : String(player.lastActionType),
        ballPosition: this.position, playerPosition: player.position,
      });
    }
    this.owner = player;
    this.lastTouchedPlayerId = player.player.id;
    this.controlOffset = this.position.subtract(player.position);
    this.intendedReceiverId = null;
    this.motion = null;
  }

  public noteTouch(playerId: string): void { this.lastTouchedPlayerId = playerId; }

  public release(): void {
    if (this.owner) this.owner.hasBall = false;
    this.owner = null;
    this.controlOffset = Vector2.zero();
  }

  public drainPossessionAcquisitions(): PossessionAcquisitionRecord[] {
    const records = this.possessionAcquisitions;
    this.possessionAcquisitions = [];
    return records;
  }

  public resolvePendingPass(controllingPlayerId: string, matchSecond: number): void {
    const pending = this.pendingPass;
    if (!pending) return;
    this.passResolutions.push({
      type: "PASS_RESOLVED",
      matchSecond,
      passerId: pending.passerId,
      intendedReceiverId: pending.intendedReceiverId,
      controllingPlayerId,
      success: controllingPlayerId === pending.intendedReceiverId,
      realForwardGain: pending.realForwardGain,
    });
    this.pendingPass = null;
  }

  public drainPassResolutions(): PassResolutionRecord[] {
    const records = this.passResolutions;
    this.passResolutions = [];
    return records;
  }

}

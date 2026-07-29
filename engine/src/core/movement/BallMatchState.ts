import { Vector2 } from "../geometry/Vector2";
import { PlayerMatchState } from "./PlayerMatchState";
import type { ShotExecution } from "../../domain/shooting";
import type { AssistIntervention } from "../../application/match/analytics/AssistPolicy";

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
  readonly startHeight: number;
  readonly targetHeight: number;
  elapsed: number;
}

export type PossessionAcquisitionReason = "PASS_RESOLUTION" | "INTENDED_RECEPTION" | "INTERCEPTION" | "PHYSICAL_CLAIM" | "TACKLE" | "GOALKEEPER_SAVE" | "RESTART" | "DRIBBLE_RECOVERY";
export interface PossessionAcquisitionRecord {
  readonly type: "POSSESSION_CHANGED";
  readonly matchSecond: number;
  readonly playerId: string;
  readonly previousPlayerId: string | null;
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

export interface LastCompletedPass {
  readonly passerId:string;
  readonly receiverId:string;
  readonly completedAtSecond:number;
  readonly interventions: AssistIntervention[];
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
  /** Spatial shot currently being resolved by ball physics. */
  public activeShot: ShotExecution | null = null;
  /** A restart taker cannot touch again before another player. */
  public restrictedTouchPlayerId: string | null = null;
  public lastTouchedPlayerId: string | null;
  public lastCompletedPass:LastCompletedPass|null=null;
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
    this.height = motion.startHeight;
    this.state = BallState.IN_FLIGHT;
    this.visualPosition = motion.origin;
    this.visualHeight = motion.startHeight;
    this.visualVelocity = motion.target.subtract(motion.origin).divide(Math.max(.01, motion.duration));
  }

  public acquirePossession(player: PlayerMatchState, reason: PossessionAcquisitionReason, matchSecond: number): void {
    const previousPlayerId = this.owner?.player.id ?? null;
    if (this.lastCompletedPass && player.player.id !== this.lastCompletedPass.receiverId
      && !this.lastCompletedPass.interventions.includes("CONTROL_CHANGE")) {
      this.lastCompletedPass.interventions.push("CONTROL_CHANGE");
    }
    if (this.owner !== player) {
      this.possessionAcquisitions.push({
        type: "POSSESSION_CHANGED", matchSecond, playerId: player.player.id,
        previousPlayerId,
        distanceToBall: player.position.distanceTo(this.position),
        ballSpeed: Math.max(this.velocity.magnitude(), this.visualVelocity.magnitude()),
        reason, previousAction: player.lastActionType === undefined ? null : String(player.lastActionType),
        ballPosition: this.position, playerPosition: player.position,
      });
    }
    this.owner = player;
    if (this.restrictedTouchPlayerId && this.restrictedTouchPlayerId !== player.player.id) {
      this.restrictedTouchPlayerId = null;
    }
    this.lastTouchedPlayerId = player.player.id;
    this.controlOffset = this.position.subtract(player.position);
    this.intendedReceiverId = null;
    this.motion = null;
  }

  public noteTouch(playerId: string): void { this.lastTouchedPlayerId = playerId; }

  public noteAssistIntervention(intervention: AssistIntervention): void {
    if (this.lastCompletedPass) this.lastCompletedPass.interventions.push(intervention);
  }

  public release(): void {
    if (this.owner) {
      this.owner.hasBall = false;
      this.owner.activeCarry = null;
    }
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
    if (controllingPlayerId === pending.intendedReceiverId) {
      this.lastCompletedPass={
        passerId:pending.passerId,
        receiverId:controllingPlayerId,
        completedAtSecond:matchSecond,
        interventions:[],
      };
    }
    this.pendingPass = null;
  }

  public drainPassResolutions(): PassResolutionRecord[] {
    const records = this.passResolutions;
    this.passResolutions = [];
    return records;
  }

}

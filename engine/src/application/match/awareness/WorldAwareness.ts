import { Vector2 } from "../../../core/geometry/Vector2";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { FieldThird } from "../../../domain";

/** Nearest opposing player relative to the deciding player. */
export interface NearestOpponent {
  readonly playerId: string;
  readonly position: Vector2;
  readonly distance: number;
  /** True when the opponent is mid-tackle (high threat). */
  readonly isTackling: boolean;
}

/** Teammate offering support / a pass option. */
export interface SupportPlayer {
  readonly playerId: string;
  readonly position: Vector2;
  readonly distance: number;
  /** Positive = further forward in the attacking direction. */
  readonly forwardProgress: number;
}

/** Evaluated pass corridor toward a teammate. */
export interface PassingLane {
  readonly targetId: string;
  readonly targetPosition: Vector2;
  readonly distance: number;
  /** Approximate line-of-sight clearance (no opponent on the segment). */
  readonly clear: boolean;
  readonly forwardProgress: number;
  /** Memory certainty when built from awareness; 1.0 for ground-truth. */
  readonly certainty: number;
}

/**
 * Pre-computed tactical snapshot for one player on one tick.
 *
 * Evaluators should read from this object instead of scanning the pitch
 * themselves. The DecisionSystem builds one WorldAwareness per decision call.
 */
export class WorldAwareness {
  constructor(
    /** Closest opponent, if any within a useful radius. */
    public readonly nearestOpponent: NearestOpponent | undefined,

    /** 0–1 pressure intensity from nearby opponents. */
    public readonly pressure: number,

    /** Distance to nearest opponent (Infinity if none). */
    public readonly nearestOpponentDistance: number,

    /** Euclidean distance to the centre of the target goal. */
    public readonly goalDistance: number,

    /** Centre of the goal the player's team is attacking. */
    public readonly goalCenter: Vector2,

    /** 0–1 how central the shooting angle is (1 = dead centre). */
    public readonly goalAngleQuality: number,

    /** Pitch third relative to the player's attacking direction. */
    public readonly fieldThird: FieldThird,

    public readonly attackingDirection: 1 | -1,

    public readonly isHome: boolean,

    /** Teammates sorted by distance (closest first). */
    public readonly supportPlayers: readonly SupportPlayer[],

    /** Pass options with clearance and progress metadata. */
    public readonly passingLanes: readonly PassingLane[],

    /** 0–1 free space around the player (1 = isolated). */
    public readonly freeSpace: number,

    /**
     * Simplified offside risk for the ball carrier's potential runners
     * (0 = safe, 1 = high risk). Full offside law is deferred.
     */
    public readonly offsideRisk: number,

    /** 0–1 quality of a crossing opportunity from current position. */
    public readonly crossOpportunity: number,

    /** 0–1 composite shot window (distance × angle × space). */
    public readonly shotWindow: number,

    /** Ground-truth opponent list (for rare advanced checks). */
    public readonly opponents: readonly PlayerMatchState[],

    /** Ground-truth teammate list excluding self. */
    public readonly teammates: readonly PlayerMatchState[],
  ) {}
}

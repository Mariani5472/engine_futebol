import { BallState } from "../../../core/movement/BallMatchState";
import type { MatchEvent, MatchPeriod } from "../../../domain";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { MatchEngine, type IncrementalMatchFrame, type MatchResult, type MatchDiagnosticEvent } from "./MatchEngine";
import type { SimulationConfig } from "./SimulationConfig";
import type { MatchTacticalDiagnostics } from "../diagnostics/TacticalDiagnosticsCollector";
import type { MatchOffensiveFunnel } from "../diagnostics/OffensiveFunnelCollector";

export interface SnapshotVector {
  readonly x: number;
  readonly y: number;
}

export interface PlayerSnapshot {
  readonly id: string;
  readonly teamId: string;
  readonly position: SnapshotVector;
  readonly velocity: SnapshotVector;
  readonly facingDirection: SnapshotVector;
  readonly role: string;
  readonly action: string | null;
  readonly hasBall: boolean;
  readonly bodyState: string;
  readonly targetPosition: SnapshotVector;
  readonly tacticalAnchorPosition: SnapshotVector;
  readonly runCorridorOrigin: SnapshotVector;
  readonly acceptedTargetChanges: number;
  readonly tacticalResponsibility: string | null;
  readonly occupiedChannel: string | null;
}

export interface BallSnapshot {
  readonly position: SnapshotVector;
  readonly logicalPosition: SnapshotVector;
  readonly velocity: SnapshotVector;
  readonly height: number;
  readonly state: string;
  readonly ownerId: string | null;
  readonly motion: { readonly kind: string; readonly hasExplicitEffect: boolean } | null;
}

export interface MatchSnapshot {
  readonly seed: number;
  readonly sequence: number;
  readonly matchSecond: number;
  readonly phase: MatchPeriod | "FINISHED";
  readonly score: { readonly homeGoals: number; readonly awayGoals: number };
  readonly possessionTeamId: string | null;
  readonly homePhase: string;
  readonly awayPhase: string;
  readonly players: readonly PlayerSnapshot[];
  readonly ball: BallSnapshot;
  readonly events: readonly MatchEvent[];
  readonly tacticalDiagnostics: MatchTacticalDiagnostics;
  readonly offensiveFunnel: MatchOffensiveFunnel;
  readonly tacticalDebug: {
    readonly carrierId: string | null;
    readonly passOptionIds: readonly string[];
    readonly homeSectors: SectorCentroids;
    readonly awaySectors: SectorCentroids;
  };
  readonly diagnostics: readonly MatchDiagnosticEvent[];
}

export interface SectorCentroids {
  readonly defence: SnapshotVector | null;
  readonly midfield: SnapshotVector | null;
  readonly attack: SnapshotVector | null;
}

export class MatchSession {
  private readonly engine = new MatchEngine();
  private readonly iterator: Generator<IncrementalMatchFrame, MatchResult, void>;
  private latestFrame: IncrementalMatchFrame | null = null;
  private finalResult: MatchResult | null = null;
  private paused = false;
  private speed = 1;

  private constructor(private readonly config: SimulationConfig) {
    this.iterator = this.engine.runIncrementally({
      ...config,
      tickDeltaSeconds: config.tickDeltaSeconds
        ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds,
    });
  }

  public static create(config: SimulationConfig): MatchSession {
    return new MatchSession(config);
  }

  public update(deltaSeconds = ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds): MatchSnapshot {
    if (this.paused || this.finalResult) return this.snapshot();
    const expected = this.config.tickDeltaSeconds
      ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;
    if (Math.abs(deltaSeconds - expected) > 1e-9) {
      throw new Error(`MatchSession requires a fixed ${expected}s update`);
    }
    const step = this.iterator.next();
    if (step.done) this.finalResult = step.value;
    else {
      this.latestFrame = step.value;
      this.finalResult = step.value.finalResult ?? null;
    }
    return this.snapshot();
  }

  public pause(): void { this.paused = true; }
  public resume(): void { this.paused = false; }
  public isPaused(): boolean { return this.paused; }
  public setSpeed(speed: number): void {
    if (![1, 2, 4, 8].includes(speed)) throw new Error("Speed must be 1, 2, 4 or 8");
    this.speed = speed;
  }
  public getSpeed(): number { return this.speed; }
  public isFinished(): boolean { return this.finalResult !== null; }
  public result(): MatchResult | null { return this.finalResult; }

  public snapshot(): MatchSnapshot {
    if (!this.latestFrame) {
      // Materialize the first real engine state without inventing API data.
      const step = this.iterator.next();
      if (step.done) this.finalResult = step.value;
      else {
        this.latestFrame = step.value;
        this.finalResult = step.value.finalResult ?? null;
      }
    }
    const frame = this.latestFrame;
    if (!frame) throw new Error("Match session produced no frame");
    const state = frame.state;
    const playerSnapshot = (teamId: string, player: typeof state.home.players[number]): PlayerSnapshot => ({
      id: player.player.id,
      teamId,
      position: { x: player.position.x, y: player.position.y },
      velocity: { x: player.velocity.x, y: player.velocity.y },
      facingDirection: { x: player.facingDirection.x, y: player.facingDirection.y },
      role: player.currentRole,
      action: player.activeAction ? String(player.activeAction.type) : null,
      hasBall: player.hasBall && !state.ball.motion,
      bodyState: player.bodyState,
      targetPosition: { x: player.targetPosition.x, y: player.targetPosition.y },
      tacticalAnchorPosition: { x: player.tacticalAnchorPosition.x, y: player.tacticalAnchorPosition.y },
      runCorridorOrigin: { x: player.runCorridorOrigin.x, y: player.runCorridorOrigin.y },
      acceptedTargetChanges: player.acceptedTargetChanges,
      tacticalResponsibility: player.tacticalResponsibility,
      occupiedChannel: player.occupiedChannel,
    });
    return {
      seed: this.config.seed,
      sequence: frame.sequence,
      matchSecond: state.currentSecond,
      phase: this.finalResult ? "FINISHED" : frame.period,
      score: { homeGoals: state.home.score, awayGoals: state.away.score },
      possessionTeamId: state.ball.owner
        ? (state.home.players.includes(state.ball.owner) ? state.home.team.id : state.away.team.id)
        : null,
      homePhase: state.home.collectivePhase,
      awayPhase: state.away.collectivePhase,
      players: [
        ...state.home.players.map((player) => playerSnapshot(state.home.team.id, player)),
        ...state.away.players.map((player) => playerSnapshot(state.away.team.id, player)),
      ],
      ball: {
        position: { x: state.ball.visualPosition.x, y: state.ball.visualPosition.y },
        logicalPosition: { x: state.ball.position.x, y: state.ball.position.y },
        velocity: { x: state.ball.visualVelocity.x, y: state.ball.visualVelocity.y },
        height: state.ball.visualHeight,
        state: BallState[state.ball.state],
        ownerId: state.ball.motion ? null : state.ball.owner?.player.id ?? null,
        motion: state.ball.motion ? { kind: state.ball.motion.kind, hasExplicitEffect: state.ball.motion.hasExplicitEffect } : null,
      },
      events: frame.events,
      tacticalDiagnostics: frame.tacticalDiagnostics,
      offensiveFunnel: frame.offensiveFunnel,
      tacticalDebug: {
        carrierId: state.ball.owner?.player.id ?? null,
        passOptionIds: state.ball.owner
          ? (state.home.players.includes(state.ball.owner) ? state.home.players : state.away.players)
              .filter(player => player !== state.ball.owner).map(player => player.player.id)
          : [],
        homeSectors: sectorCentroids(state.home.players),
        awaySectors: sectorCentroids(state.away.players),
      },
      diagnostics: frame.diagnostics,
    };
  }
}

function sectorCentroids(players: readonly { currentRole: string; position: SnapshotVector }[]): SectorCentroids {
  const groups: Record<keyof SectorCentroids, typeof players[number][]> = { defence: [], midfield: [], attack: [] };
  for (const player of players) {
    if (player.currentRole.includes("GOALKEEPER")) continue;
    const role = player.currentRole;
    const sector = role.includes("BACK") || role.includes("DEFENDER") ? "defence"
      : role.includes("STRIKER") || role.includes("FORWARD") || role.includes("WINGER") || role === "FALSE_NINE" ? "attack"
      : "midfield";
    groups[sector].push(player);
  }
  const centre = (items: typeof players[number][]): SnapshotVector | null => items.length ? ({
    x: items.reduce((sum, player) => sum + player.position.x, 0) / items.length,
    y: items.reduce((sum, player) => sum + player.position.y, 0) / items.length,
  }) : null;
  return { defence: centre(groups.defence), midfield: centre(groups.midfield), attack: centre(groups.attack) };
}

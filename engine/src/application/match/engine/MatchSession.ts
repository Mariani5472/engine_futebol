import { BallState } from "../../../core/movement/BallMatchState";
import type { MatchEvent, MatchPeriod } from "../../../domain";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { MatchEngine, type IncrementalMatchFrame, type MatchResult, type MatchDiagnosticEvent } from "./MatchEngine";
import type { SimulationConfig } from "./SimulationConfig";
import type { MatchTacticalDiagnostics } from "../diagnostics/TacticalDiagnosticsCollector";
import type { MatchOffensiveFunnel } from "../diagnostics/OffensiveFunnelCollector";
import type { EventDerivedMatchReport, MatchTimelineEntry, StoredMatchEvent } from "../analytics/MatchEventStore";
import type { GoalReplay } from "../replay/GoalReplayRecorder";
import type { DecisionDebugEntry } from "../decision/DecisionDebug";
import type { ExecutionManifest } from "./ExecutionManifest";
import { PlayerPolicyController, type PolicyDecisionRecord } from "../policy/PlayerPolicyController";
import type { PlayerActionCommand, PlayerPolicy } from "../policy/PlayerPolicy";
import { RandomValidPlayerPolicy, ScriptedPlayerPolicy } from "../policy/PlayerPolicies";
import { SeededRandom } from "../../../core/random/SeededRandom";
import { deriveSeed } from "../../../core/random/MatchRandomStreams";
import type { PlayerActionMask } from "../policy/PlayerActionSpace";
import { OBSERVATION_SPACE, type ActorObservation, type DebugObservation, type PrivilegedCriticObservation } from "../observation/ObservationSpace";

export interface SnapshotVector {
  readonly x: number;
  readonly y: number;
}

export interface PlayerSnapshot {
  readonly id: string;
  readonly teamId: string;
  readonly position: SnapshotVector;
  readonly velocity: SnapshotVector;
  readonly acceleration: SnapshotVector;
  readonly facingDirection: SnapshotVector;
  readonly bodyOrientation: number;
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
  readonly goalkeeperState: string | null;
  readonly goalkeeperInterceptionTarget: SnapshotVector | null;
  readonly goalkeeperInterceptionHeight: number | null;
  readonly animationState:string;
  readonly stamina:number;
  readonly fatigue:number;
  readonly condition:number;
  readonly currentIntent: string | null;
  readonly actionTargetId: string | null;
  readonly lastDecisionAt: number | null;
}

export interface BallSnapshot {
  readonly position: SnapshotVector;
  readonly logicalPosition: SnapshotVector;
  readonly velocity: SnapshotVector;
  readonly height: number;
  readonly state: string;
  readonly ownerId: string | null;
  readonly motion: { readonly kind: string; readonly hasExplicitEffect: boolean } | null;
  readonly activeShot: {
    readonly id: string;
    readonly shooterId: string;
    readonly lifecycle: string;
    readonly shotType: string;
    readonly intendedTarget: { readonly x: number; readonly y: number; readonly z: number };
    readonly actualTarget: { readonly x: number; readonly y: number; readonly z: number };
    readonly speed: number;
  } | null;
}

export type MatchSpeed = 1 | 2 | 4 | 8 | 50;

export interface MatchSnapshot {
  readonly manifest: ExecutionManifest;
  readonly seed: number;
  readonly sequence: number;
  readonly simulationTick: number;
  readonly simulationTimeMs: number;
  readonly matchMinute: number;
  readonly stoppageTimeSeconds: number;
  readonly lastEventSequence: number;
  readonly matchSecond: number;
  readonly phase: MatchPeriod | "FINISHED";
  readonly score: { readonly homeGoals: number; readonly awayGoals: number };
  readonly possessionTeamId: string | null;
  readonly homePhase: string;
  readonly awayPhase: string;
  readonly homePossessionState: string;
  readonly awayPossessionState: string;
  readonly possessionPrediction: {
    readonly likelyTeamId?: string;
    readonly likelyReceiverId?: string;
    readonly confidence: number;
    readonly interceptionRisk: number;
    readonly state: string;
    readonly transitionReason: string;
  };
  readonly players: readonly PlayerSnapshot[];
  readonly ball: BallSnapshot;
  readonly events: readonly MatchEvent[];
  readonly sequencedEvents: readonly StoredMatchEvent[];
  readonly tacticalDiagnostics: MatchTacticalDiagnostics;
  readonly offensiveFunnel: MatchOffensiveFunnel;
  readonly tacticalDebug: {
    readonly carrierId: string | null;
    readonly passOptionIds: readonly string[];
    readonly homeSectors: SectorCentroids;
    readonly awaySectors: SectorCentroids;
  };
  readonly diagnostics: readonly MatchDiagnosticEvent[];
  readonly timeline: readonly MatchTimelineEntry[];
  readonly replayGoalIds: readonly string[];
  readonly analytics: EventDerivedMatchReport | null;
  readonly decisionTrace:readonly DecisionDebugEntry[];
  readonly policyDecisions: readonly PolicyDecisionRecord[];
  readonly actionMasks: readonly PlayerActionMask[];
  readonly actorObservations: readonly ActorObservation[];
}

export interface SectorCentroids {
  readonly defence: SnapshotVector | null;
  readonly midfield: SnapshotVector | null;
  readonly attack: SnapshotVector | null;
}

export class MatchSession {
  private readonly engine = new MatchEngine();
  private readonly policies = new PlayerPolicyController();
  private readonly iterator: Generator<IncrementalMatchFrame, MatchResult, void>;
  private latestFrame: IncrementalMatchFrame | null = null;
  private finalResult: MatchResult | null = null;
  private paused = false;
  private speed: MatchSpeed = 1;
  private lastEventSequence = 0;

  private constructor(private readonly config: SimulationConfig) {
    this.iterator = this.engine.runIncrementally({
      ...config,
      tickDeltaSeconds: config.tickDeltaSeconds
        ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds,
    }, undefined, this.policies);
    // Prime initialization only. MatchEngine's sequence-0 frame contains the
    // kickoff state before any physical update has run.
    this.accept(this.iterator.next());
  }

  public static create(config: SimulationConfig): MatchSession {
    return new MatchSession(config);
  }

  public update(deltaSeconds = ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds): MatchSnapshot {
    this.advance(deltaSeconds);
    return this.snapshot();
  }

  /** Advances fixed-step simulation without materializing a network snapshot. */
  public advance(deltaSeconds = ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds): void {
    if (this.paused || this.finalResult) return;
    const expected = this.config.tickDeltaSeconds
      ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;
    if (Math.abs(deltaSeconds - expected) > 1e-9) {
      throw new Error(`MatchSession requires a fixed ${expected}s update`);
    }
    this.accept(this.iterator.next());
  }

  public pause(): void { this.paused = true; }
  public resume(): void { this.paused = false; }
  public isPaused(): boolean { return this.paused; }
  public setSpeed(speed: number): void {
    if (![1, 2, 4, 8, 50].includes(speed)) throw new Error("Speed must be 1, 2, 4, 8 or 50");
    this.speed = speed as MatchSpeed;
  }
  public getSpeed(): MatchSpeed { return this.speed; }
  public setPlayerPolicy(playerId: string, policy: PlayerPolicy): void {
    this.assertPlayerExists(playerId);
    this.policies.bind(playerId, policy);
  }
  public useScriptedPolicy(playerId: string, commands: readonly PlayerActionCommand[]): void {
    this.setPlayerPolicy(playerId, new ScriptedPlayerPolicy(commands, `scripted:${playerId}`));
  }
  public useRandomValidPolicy(playerId: string, seed = this.config.seed): void {
    this.setPlayerPolicy(
      playerId,
      new RandomValidPlayerPolicy(
        new SeededRandom(deriveSeed(seed, `POLICY:${playerId}`)),
        `random-valid:${playerId}`,
      ),
    );
  }
  public controlPlayer(playerId: string): void {
    this.assertPlayerExists(playerId);
    this.policies.controlExternally(playerId);
  }
  public submitPlayerAction(playerId: string, command: PlayerActionCommand): void {
    this.assertPlayerExists(playerId);
    this.policies.submit(playerId, command);
  }
  public releasePlayerControl(playerId: string): void {
    this.assertPlayerExists(playerId);
    this.policies.unbind(playerId);
  }
  public policyTranscript(): readonly PolicyDecisionRecord[] {
    return this.policies.decisions();
  }
  public actionMask(playerId: string): PlayerActionMask | null {
    this.assertPlayerExists(playerId);
    return this.policies.actionMask(playerId);
  }
  public actorObservation(playerId: string): ActorObservation | null {
    this.assertPlayerExists(playerId);
    return this.policies.actorObservation(playerId);
  }
  /** Training-only centralized state. Never included in PlayerPolicyInput or normal snapshots. */
  public privilegedCriticObservation(playerId: string): PrivilegedCriticObservation {
    this.assertPlayerExists(playerId);
    if (!this.latestFrame) throw new Error("Match session produced no frame");
    return OBSERVATION_SPACE.privilegedCritic(this.latestFrame.state, playerId);
  }
  /** Raw internal state for diagnostics. Never included in PlayerPolicyInput or normal snapshots. */
  public debugObservation(playerId: string): DebugObservation {
    this.assertPlayerExists(playerId);
    if (!this.latestFrame) throw new Error("Match session produced no frame");
    return OBSERVATION_SPACE.debug(this.latestFrame.state, playerId);
  }
  public isFinished(): boolean { return this.finalResult !== null; }
  public result(): MatchResult | null { return this.finalResult; }
  public archive():Pick<MatchResult,"manifest"|"resultHash"|"seed"|"matchDurationSeconds"|"eventStore"|"analytics"|"timeline"|"goalReplays"|"policyDecisions"|"actionMasks">|null {
    if(!this.finalResult)return null;
    const {manifest,resultHash,seed,matchDurationSeconds,eventStore,analytics,timeline,goalReplays,policyDecisions,actionMasks}=this.finalResult;
    return {manifest,resultHash,seed,matchDurationSeconds,eventStore,analytics,timeline,goalReplays,policyDecisions,actionMasks};
  }
  public goalReplay(goalEventId: string): GoalReplay | null {
    return this.latestFrame?.goalReplays.find(replay => replay.goalEventId === goalEventId)
      ?? this.finalResult?.goalReplays.find(replay => replay.goalEventId === goalEventId)
      ?? null;
  }

  public snapshot(): MatchSnapshot {
    const frame = this.latestFrame;
    if (!frame) throw new Error("Match session produced no frame");
    const state = frame.state;
    const playerSnapshot = (teamId: string, player: typeof state.home.players[number]): PlayerSnapshot => ({
      id: player.player.id,
      teamId,
      position: { x: player.position.x, y: player.position.y },
      velocity: { x: player.velocity.x, y: player.velocity.y },
      acceleration: { x: 0, y: 0 },
      facingDirection: { x: player.facingDirection.x, y: player.facingDirection.y },
      bodyOrientation: player.bodyOrientation,
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
      goalkeeperState: player.currentRole.includes("GOALKEEPER") ? player.goalkeeperState : null,
      goalkeeperInterceptionTarget: player.goalkeeperInterceptionTarget
        ? { x: player.goalkeeperInterceptionTarget.x, y: player.goalkeeperInterceptionTarget.y }
        : null,
      goalkeeperInterceptionHeight: player.currentRole.includes("GOALKEEPER")
        ? player.goalkeeperInterceptionHeight
        : null,
      animationState:frame.events.some(event=>event.type==="GOAL"&&event.scorerId===player.player.id)
        ? "CELEBRATING"
        : state.pendingGoalRestart ? "RESTART_PREPARATION"
        : player.currentRole.includes("GOALKEEPER") ? player.goalkeeperState
        : player.activeAction ? `${String(player.activeAction.type)}_${String(player.activeAction.phase)}`
        : player.velocity.magnitude()>.2 ? "RUNNING" : "IDLE",
      stamina:player.stamina,
      fatigue:player.fatigue,
      condition:Math.max(0,Math.min(1,player.stamina*(1-player.fatigue))),
      currentIntent:player.intent?.type??null,
      actionTargetId:frame.decisionTrace.find(entry=>entry.playerId===player.player.id&&entry.selected)?.targetId??null,
      lastDecisionAt:frame.decisionTrace.find(entry=>entry.playerId===player.player.id&&entry.selected)?.matchSecond??null,
    });
    return {
      manifest: frame.manifest,
      seed: this.config.seed,
      sequence: frame.sequence,
      simulationTick:frame.sequence,
      simulationTimeMs:Math.round(state.currentSecond*1000),
      matchMinute:Math.floor(state.currentSecond/60),
      stoppageTimeSeconds:0,
      lastEventSequence:this.lastEventSequence,
      matchSecond: state.currentSecond,
      phase: this.finalResult ? "FINISHED" : frame.period,
      score: { homeGoals: state.home.score, awayGoals: state.away.score },
      possessionTeamId: state.ball.owner
        ? (state.home.players.includes(state.ball.owner) ? state.home.team.id : state.away.team.id)
        : null,
      homePhase: state.home.collectivePhase,
      awayPhase: state.away.collectivePhase,
      homePossessionState: state.home.possessionState,
      awayPossessionState: state.away.possessionState,
      possessionPrediction: state.home.possessionPrediction,
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
        activeShot: state.ball.activeShot ? {
          id: state.ball.activeShot.id,
          shooterId: state.ball.activeShot.shooterId,
          lifecycle: state.ball.activeShot.lifecycle,
          shotType: state.ball.activeShot.shotType,
          intendedTarget: state.ball.activeShot.intendedTarget,
          actualTarget: state.ball.activeShot.actualTarget,
          speed: state.ball.activeShot.speed,
        } : null,
      },
      events: frame.events,
      sequencedEvents:frame.eventStore,
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
      timeline: frame.timeline,
      replayGoalIds: frame.goalReplays.map(replay => replay.goalEventId),
      analytics: frame.analytics,
      decisionTrace:frame.decisionTrace,
      policyDecisions: frame.policyDecisions,
      actionMasks: frame.actionMasks,
      actorObservations: frame.actorObservations,
    };
  }

  private assertPlayerExists(playerId: string): void {
    const exists = [...this.config.homeTeam.players, ...this.config.awayTeam.players]
      .some(player => String(player.id) === playerId);
    if (!exists) throw new Error(`Unknown player: ${playerId}`);
  }

  private accept(step: IteratorResult<IncrementalMatchFrame, MatchResult>): void {
    if (step.done) {
      this.finalResult = step.value;
      return;
    }
    this.latestFrame = step.value;
    this.finalResult = step.value.finalResult ?? null;
    this.lastEventSequence = Math.max(
      this.lastEventSequence,
      step.value.eventStore.at(-1)?.sequence ?? 0,
    );
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

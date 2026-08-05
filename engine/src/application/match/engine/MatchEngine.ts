import {
  MatchEvent, MatchPeriod, Milliseconds,
  PeriodEndedEvent, PeriodStartedEvent
} from "../../../domain";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { MovementSystem } from "../../../core/movement/MovementSystem";
import { PossessionSystem } from "../../../core/movement/PossessionSystem";
import { ReachCalculator } from "../../../core/movement/ReachCalculator";
import { PitchGrid } from "../../../core/pitch/PitchGrid";
import { Random } from "../../../core/random/Random";
import { createMatchRandomStreams } from "../../../core/random/MatchRandomStreams";
import { CognitiveContext } from "../cognitive/CognitiveContext";
import { CognitiveSystem } from "../cognitive/CognitiveSystem";
import { NoiseSystem } from "../cognitive/NoiseSystem";
import { PlayerAwareness } from "../awareness/memory/PlayerAwareness";
import { MemorySystem } from "../awareness/memory/MemorySystem";
import { PredictionSystem } from "../awareness/prediction/PredictionSystem";
import { WorldAwarenessSystem } from "../awareness/WorldAwarenessSystem";
import { PerceptionSystem } from "../perception/PerceptionSystem";
import { DecisionContext } from "../decision/DecisionContext";
import { DecisionType } from "../decision/DecisionType";
import { PossessionDecisionSystem } from "../decision/possession/PossessionDecisionSystem";
import { OffBallDecisionSystem } from "../decision/offball/OffBallDecisionSystem";
import { createPossessionEvaluators } from "../decision/possession/PossessionEvaluators";
import { createOffBallEvaluators } from "../decision/offball/OffBallEvaluators";
import { ActionFactory } from "../action/ActionFactory";
import { ActionContext } from "../action/ActionContext";
import { ActionExecution, ActionExecutionPhase } from "../action/ActionExecution";
import { ActionArbitrator } from "../action/ActionArbitrator";
import { recoverIdleActionState } from "../action/IdleActionRecovery";
import { BallPhysicsSystem } from "../physics/BallPhysicsSystem";
import { TacticalEngine } from "../tactical/TacticalEngine";
import { CollectivePhaseSystem } from "../tactical/CollectivePhaseSystem";
import { PossessionPredictionSystem } from "../tactical/PossessionPredictionSystem";
import { CollectiveCoordinationSystem } from "../tactical/CollectiveCoordinationSystem";
import { TeamBehaviourSystem } from "../team/TeamBehaviourSystem";
import { RefereeSystem } from "../referee/RefereeSystem";
import { AttackFunnelCollector } from "../diagnostics/AttackFunnelCollector";
import { MatchInitializer } from "./MatchInitializer";
import { GoalkeeperSystem } from "../goalkeeper/GoalkeeperSystem";
import { RestartSystem } from "./RestartSystem";
import { SimulationConfig } from "./SimulationConfig";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { TacticalDiagnosticsCollector } from "../diagnostics/TacticalDiagnosticsCollector";
import { BallTeleportDetector } from "../diagnostics/BallTeleportDetector";
import type { PassResolutionRecord, PossessionAcquisitionRecord } from "../../../core/movement/BallMatchState";
import { OffensiveFunnelCollector } from "../diagnostics/OffensiveFunnelCollector";
import { MatchEventStore, type EventDerivedMatchReport } from "../analytics/MatchEventStore";
import { GoalReplayRecorder } from "../replay/GoalReplayRecorder";
import { ActionId, PlayerId, TeamId } from "../../../domain";
import { DecisionDebug } from "../decision/DecisionDebug";
import { TacticalIntelligenceSystem } from "../tactical/intelligence/TacticalIntelligenceSystem";
import { resolveInstrumentation, type ResolvedInstrumentation } from "../instrumentation/TrainingInstrumentation";
import { buildExecutionManifest, verifyExecutionManifest, type ExecutionManifest } from "./ExecutionManifest";
import { PlayerPolicyController } from "../policy/PlayerPolicyController";
import { OBSERVATION_SPACE } from "../observation/ObservationSpace";
import { MatchResultAssembler } from "./MatchResultAssembler";
import type { MatchDiagnosticEvent } from "./contracts/MatchDiagnosticEvent";
import type { MatchResult } from "./contracts/MatchResult";
import type { IncrementalMatchFrame } from "./contracts/IncrementalMatchFrame";

export type { MatchDiagnosticEvent } from "./contracts/MatchDiagnosticEvent";
export type { MatchResult } from "./contracts/MatchResult";
export type { IncrementalMatchFrame } from "./contracts/IncrementalMatchFrame";

const DEFAULT_DELTA_TIME = ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;
const DEFAULT_MATCH_DURATION_SECONDS = 90 * 60;
const FATIGUE_RATE = 0.008;
const POSSESSION_DECISION_INTERVAL_SECONDS = 1;
const OFF_BALL_DECISION_INTERVAL_SECONDS = 2;
/** Perception/cognition run at 5 Hz; locomotion and physics remain at 20 Hz. */
const COGNITIVE_UPDATE_INTERVAL_TICKS = 4;
/** Expensive shared space-time field runs at 2.5 Hz; decisions reuse the latest immutable frame. */
const TACTICAL_INTELLIGENCE_UPDATE_INTERVAL_TICKS = 8;

function publishedDiagnostics(
  diagnostics: readonly MatchDiagnosticEvent[],
  instrumentation: ResolvedInstrumentation,
): readonly MatchDiagnosticEvent[] {
  return instrumentation.diagnostics
    ? diagnostics
    : diagnostics.filter(event => event.type === "BALL_TELEPORT");
}

function publishedAnalytics(
  report: EventDerivedMatchReport,
  instrumentation: ResolvedInstrumentation,
): EventDerivedMatchReport {
  if (instrumentation.detailedAnalytics) return report;
  return {
    matchId: report.matchId,
    teams: report.teams,
    players: {},
    possessionIntervals: [],
  };
}

interface MatchRuntimeContext {
  lastPossessionTeamId: string | null;
}

export class MatchEngine {
  private readonly initializer = new MatchInitializer();
  private readonly arbitrator = new ActionArbitrator();
  private readonly resultAssembler = new MatchResultAssembler();

  public simulate(
    config: SimulationConfig,
    attackFunnel?: AttackFunnelCollector,
    policies = new PlayerPolicyController(),
  ): MatchResult {
    const iterator = this.runIncrementally(config, attackFunnel, policies);
    while (true) {
      const step = iterator.next();
      if (step.done) return step.value;
    }
  }

  /** Replays only when the supplied config still matches the recorded environment contract. */
  public reproduce(
    config: SimulationConfig,
    manifest: ExecutionManifest,
    expectedResultHash?: string,
    policies = new PlayerPolicyController(),
  ): MatchResult {
    if (!verifyExecutionManifest(config, manifest)) {
      throw new Error(`Execution manifest mismatch: expected ${manifest.manifestHash}`);
    }
    const result = this.simulate(config, undefined, policies);
    if (expectedResultHash && result.resultHash !== expectedResultHash) {
      throw new Error(`Reproduced result hash mismatch: expected ${expectedResultHash}, received ${result.resultHash}`);
    }
    return result;
  }

  public *runIncrementally(
    config: SimulationConfig,
    attackFunnel?: AttackFunnelCollector,
    policies = new PlayerPolicyController(),
  ): Generator<IncrementalMatchFrame, MatchResult, void> {
    const instrumentation = resolveInstrumentation(config.instrumentation, config.debugDecisions);
    const manifest = buildExecutionManifest(config, instrumentation);
    const random = createMatchRandomStreams(config.seed);
    const deltaTime = config.tickDeltaSeconds ?? DEFAULT_DELTA_TIME;
    const matchDuration = config.maxDurationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS;
    const halfTime = matchDuration / 2;

    const runtime: MatchRuntimeContext = { lastPossessionTeamId: null };

    const pitchGrid = PitchGrid.create(config.pitch);
    const perceptionSystem = new PerceptionSystem(pitchGrid);
    const cognitiveSystem = new CognitiveSystem(
      new NoiseSystem(random.cognition),
      new MemorySystem(),
      new PredictionSystem()
    );
    const worldAwarenessSystem = new WorldAwarenessSystem(config.pitch.length);
    const decisionDebug=new DecisionDebug({maxEntries:500});
    if(instrumentation.debugSnapshots)decisionDebug.enable();
    const possessionDecisionSystem = new PossessionDecisionSystem(
      createPossessionEvaluators(),
      undefined,
      undefined,
      undefined,
      undefined,
      config.pitch.length,
      decisionDebug,
    );
    const offBallDecisionSystem = new OffBallDecisionSystem(
      createOffBallEvaluators(),
      undefined,
      undefined,
      undefined,
      undefined,
      config.pitch.length,
      decisionDebug,
    );
    const refereeSystem = new RefereeSystem(random.referee);
    const actionFactory = new ActionFactory(refereeSystem);
    const ballPhysics = new BallPhysicsSystem();
    const tacticalEngine = new TacticalEngine();
    const collectivePhaseSystem = new CollectivePhaseSystem();
    const possessionPredictionSystem = new PossessionPredictionSystem();
    const collectiveCoordination = new CollectiveCoordinationSystem();
    const tacticalIntelligence = new TacticalIntelligenceSystem();
    const goalkeeperSystem = new GoalkeeperSystem();
    const restartSystem = new RestartSystem();
    const teamBehaviour = new TeamBehaviourSystem();
    const movementSystem = new MovementSystem();
    const possessionSystem = new PossessionSystem(random.possession, new ReachCalculator());
    const tacticalDiagnostics = new TacticalDiagnosticsCollector();
    const teleportDetector = new BallTeleportDetector();
    const offensiveFunnel = new OffensiveFunnelCollector();
    const eventStore = new MatchEventStore(String(config.id));
    const replayRecorder = new GoalReplayRecorder(5, 3, deltaTime);

    const { state, awarenessMap } = this.initializer.initialize(config);
    let period: MatchPeriod = "FIRST_HALF";
    const allEvents: MatchEvent[] = [];
    const allDiagnostics: MatchDiagnosticEvent[] = [];
    let homeShots = 0;
    let awayShots = 0;
    let tick = 0;
    let halfTimeHandled = false;

    const firstHalfStarted = this.makePeriodStarted("FIRST_HALF", 0);
    if (instrumentation.eventHistory) allEvents.push(firstHalfStarted);
    eventStore.append([firstHalfStarted]);
    let lastPublishedEventSequence = 0;
    let lastPublishedPolicySequence = 0;
    let liveAnalytics = eventStore.snapshot(state);

    const initialStoredEvents = eventStore.events();
    lastPublishedEventSequence = initialStoredEvents.at(-1)?.sequence ?? 0;
    yield {
      manifest,
      sequence: 0,
      period,
      state,
      events: [firstHalfStarted],
      tacticalDiagnostics: tacticalDiagnostics.snapshot(),
      diagnostics: [],
      offensiveFunnel: offensiveFunnel.snapshot(),
      timeline: instrumentation.timeline ? eventStore.timeline() : [],
      goalReplays: [],
      decisionTrace: [],
      eventStore: instrumentation.eventHistory ? initialStoredEvents : [],
      analytics: publishedAnalytics(liveAnalytics, instrumentation),
      policyDecisions: [],
      actionMasks: [],
      actorObservations: [],
    };

    while (state.currentSecond < matchDuration) {
      const frameEvents: MatchEvent[] = [];
      if (!halfTimeHandled && state.currentSecond >= halfTime) {
        const firstHalfEnded = this.makePeriodEnded("FIRST_HALF", state.currentSecond);
        if (instrumentation.eventHistory) allEvents.push(firstHalfEnded);
        frameEvents.push(firstHalfEnded);
        period = "SECOND_HALF";
        halfTimeHandled = true;
        const secondHalfStarted = this.makePeriodStarted("SECOND_HALF", state.currentSecond);
        if (instrumentation.eventHistory) allEvents.push(secondHalfStarted);
        frameEvents.push(secondHalfStarted);
        this.swapAttackingDirections(state);
        restartSystem.setupKickoff(state, state.away, state.currentSecond);
      }

      const beforeBallPosition = state.ball.position;
      const beforeBallSpeed = state.ball.velocity.magnitude();
      const tickEvents = this.runTick(
        state, awarenessMap, random.action, deltaTime,
        perceptionSystem, cognitiveSystem, worldAwarenessSystem,
        possessionDecisionSystem, offBallDecisionSystem,
        actionFactory, ballPhysics, tacticalEngine,
        collectivePhaseSystem, possessionPredictionSystem, collectiveCoordination, tacticalIntelligence, restartSystem, goalkeeperSystem, teamBehaviour, movementSystem, possessionSystem,
        tick, period, runtime, instrumentation.diagnostics, tacticalDiagnostics, offensiveFunnel,
        attackFunnel, policies,
      );

      for (const event of tickEvents) {
        if (instrumentation.eventHistory) allEvents.push(event);
        frameEvents.push(event);
        if (event.type === "SHOT") {
          if (event.teamId === state.home.team.id) homeShots++;
          else awayShots++;
        }
      }

      if (instrumentation.diagnostics) {
        offensiveFunnel.onEvents(tickEvents, state);
        tacticalDiagnostics.sample(state, deltaTime);
      }
      attackFunnel?.sampleState(state);

      this.accumulateFatigue(state, deltaTime);
      state.currentSecond = Math.min(
        matchDuration,
        (tick + 1) * deltaTime,
      );
      const acquisitions = state.ball.drainPossessionAcquisitions();
      const passResolutions = state.ball.drainPassResolutions();
      const passEvents = passResolutions
        .filter(resolution => resolution.statisticalAttemptRecorded)
        .map(resolution => this.makePassResolutionEvent(resolution, state, period));
      const possessionEvents = acquisitions.map((acquisition, index) =>
        this.makePossessionChangedEvent(acquisition, state, period, index));
      const acquisitionEvents = acquisitions.flatMap((acquisition, index) =>
        this.makeAcquisitionSemanticEvents(acquisition, state, period, index));
      if (instrumentation.eventHistory) allEvents.push(...passEvents, ...possessionEvents, ...acquisitionEvents);
      frameEvents.push(...passEvents, ...possessionEvents, ...acquisitionEvents);
      if (instrumentation.diagnostics) {
        for (const resolution of passResolutions) offensiveFunnel.onPassResolution(resolution, state);
        offensiveFunnel.onAcquisitions(acquisitions, state);
        offensiveFunnel.sample(state);
      }
      const teleports = teleportDetector.inspectTick({
        seed: config.seed, matchSecond: state.currentSecond, deltaTime,
        before: beforeBallPosition, after: state.ball.position,
        beforeSpeed: beforeBallSpeed, afterSpeed: state.ball.velocity.magnitude(),
        physicsDisplacement: state.ball.lastPhysicsDisplacement,
        acquisitions,
        isRestart: tickEvents.some(event => event.type === "GOAL" || event.type === "THROW_IN" || event.type === "GOAL_KICK")
          || acquisitions.some(acquisition => acquisition.reason === "RESTART"),
      });
      const tickDiagnostics: MatchDiagnosticEvent[] = [...acquisitions, ...passResolutions, ...teleports];
      allDiagnostics.push(...publishedDiagnostics(tickDiagnostics, instrumentation));
      eventStore.append(frameEvents);
      eventStore.sample(state);
      if (instrumentation.replay) replayRecorder.sample(state, frameEvents);
      tick++;
      if (tick % Math.max(1, Math.round(1 / deltaTime)) === 0) liveAnalytics = eventStore.snapshot(state);
      const storedFrameEvents = eventStore.events().filter(event => event.sequence > lastPublishedEventSequence);
      lastPublishedEventSequence = storedFrameEvents.at(-1)?.sequence ?? lastPublishedEventSequence;
      const framePolicyDecisions = policies.decisionsAfter(lastPublishedPolicySequence);
      lastPublishedPolicySequence = framePolicyDecisions.at(-1)?.sequence ?? lastPublishedPolicySequence;

      if (state.currentSecond >= matchDuration) {
        const matchEnded = this.makePeriodEnded("SECOND_HALF", state.currentSecond);
        if (instrumentation.eventHistory) allEvents.push(matchEnded);
        frameEvents.push(matchEnded);
        eventStore.append([matchEnded]);
        if (instrumentation.replay) replayRecorder.sample(state, [matchEnded]);
        const goalReplays = instrumentation.replay ? replayRecorder.replays() : [];
        const finalAnalytics = eventStore.finalize(state);
        const finalResult = this.resultAssembler.assemble({
          manifest,
          seed: config.seed,
          state,
          instrumentation,
          allEvents,
          homeShots,
          awayShots,
          diagnostics: publishedDiagnostics(allDiagnostics, instrumentation),
          offensiveFunnel: offensiveFunnel.snapshot(),
          tacticalDiagnostics: tacticalDiagnostics.snapshot(),
          eventStore,
          analytics: finalAnalytics,
          goalReplays,
          decisionDebug,
          policies,
        });
        yield { manifest, sequence: tick, period, state, events: frameEvents, finalResult, tacticalDiagnostics: tacticalDiagnostics.snapshot(), diagnostics: publishedDiagnostics(tickDiagnostics, instrumentation), offensiveFunnel: offensiveFunnel.snapshot(), timeline: finalResult.timeline, goalReplays, decisionTrace:instrumentation.debugSnapshots?decisionDebug.getEntries().filter(entry=>entry.tick>=tick-1):[], eventStore:instrumentation.eventHistory?storedFrameEvents:[], analytics:finalResult.analytics, policyDecisions: framePolicyDecisions, actionMasks: policies.actionMasks(), actorObservations: policies.actorObservations() };
        return finalResult;
      }

      yield {
        manifest,
        sequence: tick,
        period,
        state,
        events: frameEvents,
        tacticalDiagnostics: tacticalDiagnostics.snapshot(),
        diagnostics: publishedDiagnostics(tickDiagnostics, instrumentation),
        offensiveFunnel: offensiveFunnel.snapshot(),
        timeline: instrumentation.timeline ? eventStore.timeline(new Set(replayRecorder.replays().map(replay => replay.goalEventId))) : [],
        goalReplays: instrumentation.replay ? replayRecorder.replays() : [],
        decisionTrace:instrumentation.debugSnapshots?decisionDebug.getEntries().filter(entry=>entry.tick>=tick-1):[],
        eventStore:instrumentation.eventHistory?storedFrameEvents:[],
        analytics:publishedAnalytics(liveAnalytics, instrumentation),
        policyDecisions: framePolicyDecisions,
        actionMasks: policies.actionMasks(),
        actorObservations: policies.actorObservations(),
      };
    }

    const finalPeriodEnded = this.makePeriodEnded("SECOND_HALF", state.currentSecond);
    if (instrumentation.eventHistory) allEvents.push(finalPeriodEnded);
    eventStore.append([finalPeriodEnded]);

    const finalAnalytics = eventStore.finalize(state);
    const goalReplays = instrumentation.replay ? replayRecorder.replays() : [];
    return this.resultAssembler.assemble({
      manifest,
      seed: config.seed,
      state,
      instrumentation,
      allEvents,
      homeShots,
      awayShots,
      diagnostics: publishedDiagnostics(allDiagnostics, instrumentation),
      offensiveFunnel: offensiveFunnel.snapshot(),
      tacticalDiagnostics: tacticalDiagnostics.snapshot(),
      eventStore,
      analytics: finalAnalytics,
      goalReplays,
      decisionDebug,
      policies,
    });
  }

  private runTick(
    state: MatchState,
    awarenessMap: Map<string, PlayerAwareness>,
    rng: Random,
    deltaTime: number,
    perceptionSystem: PerceptionSystem,
    cognitiveSystem: CognitiveSystem,
    worldAwarenessSystem: WorldAwarenessSystem,
    possessionDecisionSystem: PossessionDecisionSystem,
    offBallDecisionSystem: OffBallDecisionSystem,
    actionFactory: ActionFactory,
    ballPhysics: BallPhysicsSystem,
    tacticalEngine: TacticalEngine,
    collectivePhaseSystem: CollectivePhaseSystem,
    possessionPredictionSystem: PossessionPredictionSystem,
    collectiveCoordination: CollectiveCoordinationSystem,
    tacticalIntelligence: TacticalIntelligenceSystem,
    restartSystem: RestartSystem,
    goalkeeperSystem: GoalkeeperSystem,
    teamBehaviour: TeamBehaviourSystem,
    movementSystem: MovementSystem,
    possessionSystem: PossessionSystem,
    tick: number,
    period: MatchPeriod,
    runtime: MatchRuntimeContext,
    collectDiagnostics: boolean,
    tacticalDiagnostics: TacticalDiagnosticsCollector,
    offensiveFunnel: OffensiveFunnelCollector,
    attackFunnel?: AttackFunnelCollector,
    policies = new PlayerPolicyController(),
  ): MatchEvent[] {
    const events: MatchEvent[] = [];
    const players = this.allPlayers(state);
    if (state.pendingGoalRestart && state.currentSecond + 1e-9 >= state.pendingGoalRestart.executeAt) {
      const conceding = state.pendingGoalRestart.concedingTeamId === state.home.team.id ? state.home : state.away;
      state.pendingGoalRestart = null;
      restartSystem.setupKickoff(state, conceding, state.currentSecond);
    }
    const goalRestartWaiting = state.pendingGoalRestart !== null;
    const restartWaiting = restartSystem.update(state);
    const kickoffWaiting = goalRestartWaiting || restartWaiting;

    for (const player of players) {
      recoverIdleActionState(player, deltaTime);
    }

    if (tick % COGNITIVE_UPDATE_INTERVAL_TICKS === 0) {
      const perceptions = perceptionSystem.update(state);
      for (const player of players) {
        const awareness = awarenessMap.get(player.player.id);
        const perception = perceptions.get(player.player.id);
        if (!awareness || !perception) continue;

        cognitiveSystem.update({
          player,
          awareness,
          perception,
          deltaTime: deltaTime * COGNITIVE_UPDATE_INTERVAL_TICKS,
          tick
        } satisfies CognitiveContext);
      }
    }

    const tacticalSnapshot = tick % TACTICAL_INTELLIGENCE_UPDATE_INTERVAL_TICKS === 0
      ? tacticalIntelligence.update(state)
      : tacticalIntelligence.snapshot();

    const executingCandidates: ActionExecution[] = [];

    for (const player of players) {
      if (!player.activeAction && !player.activePipeline) continue;

      const previousPhase = player.activeAction?.phase;
      const phase = actionFactory.advanceOnly(player, state.currentSecond);

      if (
        phase === ActionExecutionPhase.EXECUTING &&
        previousPhase !== ActionExecutionPhase.EXECUTING &&
        player.activeAction
      ) {
        executingCandidates.push(player.activeAction);
        if (
          attackFunnel &&
          (player.activeAction.type === DecisionType.PASS ||
            player.activeAction.type === DecisionType.CROSS)
        ) {
          attackFunnel.onPassReachedExecuting();
        }
      }
    }

    const winners = this.arbitrator.resolve(
      executingCandidates,
      state,
      state.currentSecond,
    );

    for (const execution of winners) {
      this.resolveAndRecord(
        execution,
        players,
        state,
        rng,
        tick,
        deltaTime,
        actionFactory,
        events,
        attackFunnel,
      );
    }

    for (const player of players) {
      if (kickoffWaiting) continue;
      if (player.scenarioDecisionDisabled) continue;
      if (player.isActionBusy()) continue;
      if (state.currentSecond + 1e-9 < player.nextDecisionAt) continue;

      const awareness = awarenessMap.get(player.player.id);
      if (!awareness) continue;

      const world = worldAwarenessSystem.build(state, player, awareness);
      const decisionCtx = new DecisionContext(
        state, player, awareness, tick, deltaTime, world, tacticalSnapshot,
      );
      const heuristicDecision = () => player.hasBall
        ? possessionDecisionSystem.decide(decisionCtx)
        : offBallDecisionSystem.decide(decisionCtx);
      const validDecisions = policies.hasPolicy(player.player.id)
        ? (player.hasBall
            ? possessionDecisionSystem.availableDecisions(decisionCtx)
            : offBallDecisionSystem.availableDecisions(decisionCtx))
        : [];
      const decision = policies.decide({
        playerId: player.player.id,
        matchSecond: state.currentSecond,
        hasBall: player.hasBall,
        validDecisions,
        heuristicDecision,
        buildActorObservation: mask => OBSERVATION_SPACE.actor(decisionCtx, mask),
      });
      if (!decision) continue;

      player.nextDecisionAt =
        state.currentSecond +
        (player.hasBall
          ? POSSESSION_DECISION_INTERVAL_SECONDS
          : OFF_BALL_DECISION_INTERVAL_SECONDS);

      if (player.hasBall && attackFunnel) {
        attackFunnel.onPossessionDecision(decision.type, player, world, decision);
      }
      if (player.hasBall && collectDiagnostics) offensiveFunnel.onDecision(player, decision, world, state);

      const started = actionFactory.tryStart(decision, player, state.currentSecond);
      if (!started) continue;

      if (collectDiagnostics) tacticalDiagnostics.onActionStarted(player, decision.type, state);

      if (
        attackFunnel &&
        (decision.type === DecisionType.PASS || decision.type === DecisionType.CROSS)
      ) {
        const timing = player.activeAction?.timing;
        attackFunnel.onPassTryStart(
          timing?.windupSeconds,
          timing?.recoverySeconds,
        );
      }

      if (
        player.activeAction &&
        player.activeAction.phase === ActionExecutionPhase.EXECUTING
      ) {
        if (
          attackFunnel &&
          (decision.type === DecisionType.PASS || decision.type === DecisionType.CROSS)
        ) {
          attackFunnel.onPassReachedExecuting();
        }
        this.resolveAndRecord(
          player.activeAction,
          players,
          state,
          rng,
          tick,
          deltaTime,
          actionFactory,
          events,
          attackFunnel,
        );
      }
    }

    tacticalEngine.update(state);
    teamBehaviour.update(state);
    collectiveCoordination.update(state);
    tacticalIntelligence.intents.enforce(state);
    goalkeeperSystem.update(state);
    restartSystem.enforceWaitingPositions(state);
    movementSystem.update(state, deltaTime);
    // Movement targets can be recalculated during the preparation window. Clamp
    // once more before publishing the frame so no opponent enters the circle.
    restartSystem.enforceWaitingPositions(state);
    // The authoritative ball follows the player's position from this same tick,
    // avoiding a one-frame correction on the next update.
    events.push(...ballPhysics.update(state, deltaTime));
    possessionSystem.update(state);
    restartSystem.update(state);
    this.syncPossessionSide(state, runtime);
    possessionPredictionSystem.update(state);
    collectivePhaseSystem.update(state, events);

    void period;
    return events;
  }

  private resolveAndRecord(
    execution: ActionExecution,
    players: PlayerMatchState[],
    state: MatchState,
    rng: Random,
    tick: number,
    deltaTime: number,
    actionFactory: ActionFactory,
    events: MatchEvent[],
    attackFunnel?: AttackFunnelCollector,
  ): void {
    const player = players.find((p) => p.activeAction === execution);
    if (!player) return;
    if (player.activePipeline && !player.activePipeline.isBusy()) return;
    if (execution.interruptionReason) return;

    const isHome = state.home.players.includes(player);
    const teamState = isHome ? state.home : state.away;

    const actionCtx: ActionContext = {
      player,
      decision: execution.decision,
      match: state,
      pitch: state.pitch,
      random: rng,
      tick,
      deltaTime,
      teamSide: isHome ? "HOME" : "AWAY",
      attackingDirection: teamState.attackingDirection,
      matchSecond: state.currentSecond,
    };

    const result = actionFactory.resolveExecuting(execution, actionCtx);
    events.push(...result.events);

    if (
      attackFunnel &&
      (execution.decision.type === DecisionType.PASS ||
        execution.decision.type === DecisionType.CROSS)
    ) {
      attackFunnel.onPassResolved(
        result.meta?.passRealForwardGain ?? 0,
        result.meta?.laneForwardProgress,
        result.success,
      );
    }
  }

  private syncPossessionSide(state: MatchState, runtime: MatchRuntimeContext): void {
    const owner = state.ball.owner;
    if (!owner) {
      // Ball flight has no physical owner. Change collective attacking side
      // only when ETA/control prediction provides strong evidence, never from
      // controllerId === null alone.
      const prediction = state.home.possessionPrediction;
      if (prediction.likelyTeamId && prediction.confidence >= .68 && prediction.state !== "contested") {
        const likely = prediction.likelyTeamId === state.home.team.id ? state.home : state.away;
        state.attackingTeam = likely;
        state.defendingTeam = likely === state.home ? state.away : state.home;
      }
      return;
    }
    const ownerIsHome = state.home.players.includes(owner);
    const team = ownerIsHome ? state.home : state.away;
    const other = ownerIsHome ? state.away : state.home;

    state.attackingTeam = team;
    state.defendingTeam = other;

    if (runtime.lastPossessionTeamId !== team.team.id) {
      // Fresh possession spell for this team — allow up to MAX shots again.
      team.resetPossessionShotCount();
      runtime.lastPossessionTeamId = team.team.id;
    }
  }

  private swapAttackingDirections(state: MatchState): void {
    const home = state.home as { attackingDirection: 1 | -1 };
    const away = state.away as { attackingDirection: 1 | -1 };
    home.attackingDirection = home.attackingDirection === 1 ? -1 : 1;
    away.attackingDirection = away.attackingDirection === 1 ? -1 : 1;
  }

  private accumulateFatigue(state: MatchState, deltaTime: number): void {
    for (const player of this.allPlayers(state)) {
      const workRate = player.player.attributes.mental.workRate / 20;
      const speed = player.velocity.magnitude();
      const activityFactor = 0.3 + speed * 0.05 + workRate * 0.2;
      player.fatigue = Math.min(100, player.fatigue + FATIGUE_RATE * activityFactor * deltaTime);
    }
  }

  private allPlayers(state: MatchState): PlayerMatchState[] {
    return [...state.home.players, ...state.away.players];
  }

  private makePeriodStarted(
    periodName: "FIRST_HALF" | "SECOND_HALF",
    second: number
  ): PeriodStartedEvent {
    return {
      id: `period-start-${periodName}`,
      type: "PERIOD_STARTED",
      timestamp: (second * 1000) as Milliseconds,
      period: periodName,
      periodName
    };
  }

  private makePassResolutionEvent(
    resolution: PassResolutionRecord,
    state: MatchState,
    period: MatchPeriod,
  ): MatchEvent {
    const passer = this.allPlayers(state).find(player => player.player.id === resolution.passerId);
    const team = passer && state.home.players.includes(passer) ? state.home : state.away;
    return {
      id: resolution.actionId
        ? `${resolution.actionId}:pass-resolved`
        : `pass-resolution-${resolution.passerId}-${resolution.matchSecond.toFixed(6)}`,
      actionId: resolution.actionId as ActionId | undefined,
      type: resolution.success ? "PASS_COMPLETED" : "PASS_INTERCEPTED",
      timestamp: (resolution.matchSecond * 1000) as Milliseconds,
      period,
      teamId: team.team.id as TeamId,
      playerId: resolution.passerId as PlayerId,
      receiverId: resolution.controllingPlayerId as PlayerId,
      intendedReceiverId: resolution.intendedReceiverId as PlayerId,
      controllingPlayerId: resolution.controllingPlayerId as PlayerId,
      forwardGain: resolution.realForwardGain,
      intendedReceiverDistance:resolution.intendedReceiverDistance,
    };
  }

  private makePossessionChangedEvent(
    acquisition: PossessionAcquisitionRecord,
    state: MatchState,
    period: MatchPeriod,
    acquisitionIndex: number,
  ): MatchEvent {
    const player = this.allPlayers(state).find(candidate=>candidate.player.id===acquisition.playerId);
    const team = player && state.home.players.includes(player) ? state.home : state.away;
    return {
      id:acquisition.actionId
        ? `${acquisition.actionId}:possession:${acquisition.playerId}`
        : `possession-${acquisition.playerId}-${acquisition.matchSecond.toFixed(6)}-${acquisitionIndex}`,
      actionId:acquisition.actionId as ActionId|undefined,
      type:"POSSESSION_CHANGED", timestamp:(acquisition.matchSecond*1000) as Milliseconds,
      period, teamId:team.team.id as TeamId, playerId:acquisition.playerId as PlayerId,
      previousPlayerId:acquisition.previousPlayerId as PlayerId|null, reason:acquisition.reason,
      contested: acquisition.contested ?? false,
      positionX:acquisition.ballPosition.x, positionY:acquisition.ballPosition.y,
      ballSpeed:acquisition.ballSpeed,
    };
  }

  private makeAcquisitionSemanticEvents(
    acquisition: PossessionAcquisitionRecord,
    state: MatchState,
    period: MatchPeriod,
    acquisitionIndex: number,
  ): MatchEvent[] {
    const player = this.allPlayers(state).find(candidate => candidate.player.id === acquisition.playerId);
    if (!player) return [];
    const team = state.home.players.includes(player) ? state.home : state.away;
    const baseId = acquisition.actionId
      ? `${acquisition.actionId}:${acquisition.playerId}`
      : `${acquisition.playerId}-${acquisition.matchSecond.toFixed(6)}-${acquisitionIndex}`;
    const common = {
      timestamp: (acquisition.matchSecond * 1000) as Milliseconds,
      period,
      teamId: team.team.id as TeamId,
      playerId: acquisition.playerId as PlayerId,
      positionX: acquisition.ballPosition.x,
      positionY: acquisition.ballPosition.y,
      actionId: acquisition.actionId as ActionId | undefined,
    };
    const events: MatchEvent[] = [];

    if (acquisition.reason === "INTERCEPTION") {
      events.push({
        ...common, id: `${baseId}:interception`, type: "INTERCEPTION",
        passerId: acquisition.previousPlayerId as PlayerId | null,
      });
    } else if (acquisition.reason === "DRIBBLE_RECOVERY") {
      events.push({
        ...common, id: `${baseId}:recovery`, type: "BALL_RECOVERY",
        previousTouchPlayerId: acquisition.previousPlayerId as PlayerId | null,
        recoveryKind: "DRIBBLE",
      });
    } else if (acquisition.reason === "PHYSICAL_CLAIM" && !acquisition.contested
      && acquisition.wasLoose && acquisition.previousPlayerId) {
      const previous = this.allPlayers(state)
        .find(candidate => candidate.player.id === acquisition.previousPlayerId);
      const previousWasOpponent = previous
        ? state.home.players.includes(previous) !== state.home.players.includes(player)
        : false;
      if (previousWasOpponent) {
        events.push({
          ...common, id: `${baseId}:recovery`, type: "BALL_RECOVERY",
          previousTouchPlayerId: acquisition.previousPlayerId as PlayerId,
          recoveryKind: "LOOSE_BALL",
        });
      }
    }

    if (acquisition.contested && acquisition.opponentId && acquisition.duelKind) {
      events.push({
        ...common, id: `${baseId}:duel`, type: "DUEL",
        opponentId: acquisition.opponentId as PlayerId,
        winnerId: acquisition.playerId as PlayerId,
        loserId: acquisition.opponentId as PlayerId,
        duelKind: acquisition.duelKind,
      });
    }
    return events;
  }

  private makePeriodEnded(
    periodName: "FIRST_HALF" | "SECOND_HALF",
    second: number
  ): PeriodEndedEvent {
    return {
      id: `period-end-${periodName}`,
      type: "PERIOD_ENDED",
      timestamp: (second * 1000) as Milliseconds,
      period: periodName,
      periodName
    };
  }
}

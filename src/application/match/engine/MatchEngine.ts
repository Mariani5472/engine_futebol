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
import { SeededRandom } from "../../../core/random/SeededRandom";
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
import { TeamBehaviourSystem } from "../team/TeamBehaviourSystem";
import { RefereeSystem } from "../referee/RefereeSystem";
import { MatchMetricsCollector } from "../metrics/MatchMetricsCollector";
import { MatchMetrics } from "../metrics/MatchMetrics";
import { AttackFunnelCollector } from "../diagnostics/AttackFunnelCollector";
import { MatchInitializer } from "./MatchInitializer";
import { SimulationConfig } from "./SimulationConfig";

const DEFAULT_DELTA_TIME = 0.5;
const DEFAULT_MATCH_DURATION_SECONDS = 90 * 60;
const FATIGUE_RATE = 0.008;

export interface MatchResult {
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly events: MatchEvent[];
  readonly homeShots: number;
  readonly awayShots: number;
  readonly matchDurationSeconds: number;
  readonly seed: number;
  readonly metrics: MatchMetrics;
}

export class MatchEngine {
  private readonly initializer = new MatchInitializer();
  private readonly arbitrator = new ActionArbitrator();
  /** Tracks which team last held continuous possession for shot-count reset. */
  private lastPossessionTeamId: string | null = null;

  public simulate(
    config: SimulationConfig,
    attackFunnel?: AttackFunnelCollector,
  ): MatchResult {
    const rng = new SeededRandom(config.seed);
    const deltaTime = config.tickDeltaSeconds ?? DEFAULT_DELTA_TIME;
    const matchDuration = config.maxDurationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS;
    const halfTime = matchDuration / 2;

    this.lastPossessionTeamId = null;

    const pitchGrid = PitchGrid.create(config.pitch);
    const perceptionSystem = new PerceptionSystem(pitchGrid);
    const cognitiveSystem = new CognitiveSystem(
      new NoiseSystem(rng),
      new MemorySystem(),
      new PredictionSystem()
    );
    const worldAwarenessSystem = new WorldAwarenessSystem(config.pitch.length);
    const possessionDecisionSystem = new PossessionDecisionSystem(
      createPossessionEvaluators(),
      undefined,
      undefined,
      undefined,
      undefined,
      config.pitch.length
    );
    const offBallDecisionSystem = new OffBallDecisionSystem(
      createOffBallEvaluators(),
      undefined,
      undefined,
      undefined,
      undefined,
      config.pitch.length
    );
    const refereeSystem = new RefereeSystem(rng);
    const actionFactory = new ActionFactory(refereeSystem);
    const ballPhysics = new BallPhysicsSystem();
    const tacticalEngine = new TacticalEngine();
    const teamBehaviour = new TeamBehaviourSystem();
    const movementSystem = new MovementSystem();
    const possessionSystem = new PossessionSystem(rng, new ReachCalculator());
    const metrics = new MatchMetricsCollector();

    const { state, awarenessMap } = this.initializer.initialize(config);
    metrics.bindTeams(state.home.team.id, state.away.team.id);

    let period: MatchPeriod = "FIRST_HALF";
    const allEvents: MatchEvent[] = [];
    let homeShots = 0;
    let awayShots = 0;
    let tick = 0;
    let halfTimeHandled = false;

    allEvents.push(this.makePeriodStarted("FIRST_HALF", 0));

    while (state.currentSecond < matchDuration) {
      if (!halfTimeHandled && state.currentSecond >= halfTime) {
        allEvents.push(this.makePeriodEnded("FIRST_HALF", state.currentSecond));
        period = "SECOND_HALF";
        halfTimeHandled = true;
        allEvents.push(this.makePeriodStarted("SECOND_HALF", state.currentSecond));
        this.swapAttackingDirections(state);
      }

      const tickEvents = this.runTick(
        state, awarenessMap, rng, deltaTime,
        perceptionSystem, cognitiveSystem, worldAwarenessSystem,
        possessionDecisionSystem, offBallDecisionSystem,
        actionFactory, ballPhysics, tacticalEngine,
        teamBehaviour, movementSystem, possessionSystem,
        tick, period, metrics, attackFunnel
      );

      for (const event of tickEvents) {
        allEvents.push(event);
        if (event.type === "SHOT") {
          if (event.teamId === state.home.team.id) homeShots++;
          else awayShots++;
        }
      }

      metrics.onEvents(tickEvents, state);
      metrics.sampleState(state);
      attackFunnel?.sampleState(state);

      this.accumulateFatigue(state, deltaTime);
      state.currentSecond += deltaTime;
      tick++;
    }

    allEvents.push(this.makePeriodEnded("SECOND_HALF", state.currentSecond));

    const finalMetrics = metrics.finalize();

    return {
      homeTeamId: state.home.team.id,
      awayTeamId: state.away.team.id,
      homeScore: state.home.score,
      awayScore: state.away.score,
      events: allEvents,
      homeShots,
      awayShots,
      matchDurationSeconds: state.currentSecond,
      seed: config.seed,
      metrics: finalMetrics,
    };
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
    teamBehaviour: TeamBehaviourSystem,
    movementSystem: MovementSystem,
    possessionSystem: PossessionSystem,
    tick: number,
    period: MatchPeriod,
    metrics: MatchMetricsCollector,
    attackFunnel?: AttackFunnelCollector,
  ): MatchEvent[] {
    const events: MatchEvent[] = [];
    const players = this.allPlayers(state);

    for (const player of players) {
      recoverIdleActionState(player, deltaTime);
    }

    const perceptions = perceptionSystem.update(state);

    for (const player of players) {
      const awareness = awarenessMap.get(player.player.id);
      const perception = perceptions.get(player.player.id);
      if (!awareness || !perception) continue;

      cognitiveSystem.update({
        player,
        awareness,
        perception,
        deltaTime,
        tick
      } satisfies CognitiveContext);
    }

    const executingCandidates: ActionExecution[] = [];

    for (const player of players) {
      if (!player.activeAction && !player.activePipeline) continue;

      const phase = actionFactory.advanceOnly(player, state.currentSecond);

      if (phase === ActionExecutionPhase.EXECUTING && player.activeAction) {
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
      if (player.isActionBusy()) continue;

      const awareness = awarenessMap.get(player.player.id);
      if (!awareness) continue;

      const world = worldAwarenessSystem.build(state, player, awareness);
      const decisionCtx = new DecisionContext(
        state, player, awareness, tick, deltaTime, world,
      );
      const decision = player.hasBall
        ? possessionDecisionSystem.decide(decisionCtx)
        : offBallDecisionSystem.decide(decisionCtx);

      if (player.hasBall && attackFunnel) {
        attackFunnel.onPossessionDecision(decision.type, player, world, decision);
      }

      const started = actionFactory.tryStart(decision, player, state.currentSecond);
      if (!started) continue;

      metrics.onActionStarted(player, decision.type, state);

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

    ballPhysics.update(state, deltaTime);
    tacticalEngine.update(state);
    teamBehaviour.update(state);
    movementSystem.update(state, deltaTime);
    possessionSystem.update(state);
    this.syncPossessionSide(state);

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

  private syncPossessionSide(state: MatchState): void {
    const owner = state.ball.owner;
    if (!owner) {
      this.lastPossessionTeamId = null;
      return;
    }
    const ownerIsHome = state.home.players.includes(owner);
    const team = ownerIsHome ? state.home : state.away;
    const other = ownerIsHome ? state.away : state.home;

    state.attackingTeam = team;
    state.defendingTeam = other;

    if (this.lastPossessionTeamId !== team.team.id) {
      // Fresh possession spell for this team — allow up to MAX shots again.
      team.resetPossessionShotCount();
      this.lastPossessionTeamId = team.team.id;
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

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
import { PerceptionSystem } from "../perception/PerceptionSystem";
import { DecisionContext } from "../decision/DecisionContext";
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
import { MatchInitializer } from "./MatchInitializer";
import { SimulationConfig } from "./SimulationConfig";

/** Default simulation delta time in seconds per tick. */
const DEFAULT_DELTA_TIME = 0.5;
/** Default match duration in seconds (90 minutes). */
const DEFAULT_MATCH_DURATION_SECONDS = 90 * 60;
/** Fatigue rate per second (percentage points). */
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
}

export class MatchEngine {
  private readonly initializer = new MatchInitializer();
  private readonly arbitrator = new ActionArbitrator();

  public simulate(config: SimulationConfig): MatchResult {
    const rng = new SeededRandom(config.seed);
    const deltaTime = config.tickDeltaSeconds ?? DEFAULT_DELTA_TIME;
    const matchDuration = config.maxDurationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS;
    const halfTime = matchDuration / 2;

    // Build all systems.
    const pitchGrid = PitchGrid.create(config.pitch);
    const perceptionSystem = new PerceptionSystem(pitchGrid);
    const cognitiveSystem = new CognitiveSystem(
      new NoiseSystem(rng),
      new MemorySystem(),
      new PredictionSystem()
    );
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

    // Initialize simulation state.
    const { state, awarenessMap } = this.initializer.initialize(config);

    let period: MatchPeriod = "FIRST_HALF";
    const allEvents: MatchEvent[] = [];
    let homeShots = 0;
    let awayShots = 0;
    let tick = 0;
    let halfTimeHandled = false;

    allEvents.push(this.makePeriodStarted("FIRST_HALF", 0));

    // Main simulation loop.
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
        perceptionSystem, cognitiveSystem,
        possessionDecisionSystem, offBallDecisionSystem,
        actionFactory, ballPhysics, tacticalEngine,
        teamBehaviour, movementSystem, possessionSystem,
        tick, period
      );

      for (const event of tickEvents) {
        allEvents.push(event);
        if (event.type === "SHOT") {
          if (event.teamId === state.home.team.id) homeShots++;
          else awayShots++;
        }
      }

      this.accumulateFatigue(state, deltaTime);
      state.currentSecond += deltaTime;
      tick++;
    }

    allEvents.push(this.makePeriodEnded("SECOND_HALF", state.currentSecond));

    return {
      homeTeamId: state.home.team.id,
      awayTeamId: state.away.team.id,
      homeScore: state.home.score,
      awayScore: state.away.score,
      events: allEvents,
      homeShots,
      awayShots,
      matchDurationSeconds: state.currentSecond,
      seed: config.seed
    };
  }

  /**
   * Tick order (Phase 2 — scheduler):
   *
   * 1. Recover idle body state
   * 2. Perception + cognition
   * 3. Advance existing ActionExecutions
   * 4. Collect actions that reached EXECUTING
   * 5. ActionArbitrator resolves conflicts
   * 6. Apply consequences of winning actions
   * 7. Evaluate new decisions for free players
   * 8. Create new ActionExecutions
   * 9. Ball physics / tactical / movement / possession
   */
  private runTick(
    state: MatchState,
    awarenessMap: Map<string, PlayerAwareness>,
    rng: Random,
    deltaTime: number,
    perceptionSystem: PerceptionSystem,
    cognitiveSystem: CognitiveSystem,
    possessionDecisionSystem: PossessionDecisionSystem,
    offBallDecisionSystem: OffBallDecisionSystem,
    actionFactory: ActionFactory,
    ballPhysics: BallPhysicsSystem,
    tacticalEngine: TacticalEngine,
    teamBehaviour: TeamBehaviourSystem,
    movementSystem: MovementSystem,
    possessionSystem: PossessionSystem,
    tick: number,
    period: MatchPeriod
  ): MatchEvent[] {
    const events: MatchEvent[] = [];
    const players = this.allPlayers(state);

    // 1. Passive recovery for players without an active action.
    for (const player of players) {
      recoverIdleActionState(player, deltaTime);
    }

    // 2. Perception + cognition.
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

    // 3 + 4. Advance existing actions and collect those that reached EXECUTING.
    const executingCandidates: ActionExecution[] = [];

    for (const player of players) {
      if (!player.activeAction) continue;

      const phase = actionFactory.advanceOnly(player, state.currentSecond);

      if (phase === ActionExecutionPhase.EXECUTING && player.activeAction) {
        executingCandidates.push(player.activeAction);
      }
    }

    // 5. Arbitrate concurrent executions.
    const winners = this.arbitrator.resolve(
      executingCandidates,
      state,
      state.currentSecond,
    );

    // 6. Apply consequences of winning actions.
    for (const execution of winners) {
      const player = players.find((p) => p.activeAction === execution);
      if (!player) continue;

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
    }

    // 7 + 8. Evaluate new decisions and start ActionExecutions for free players.
    for (const player of players) {
      // Still busy (preparing / recovering / just executed) → skip decision.
      if (player.isActionBusy()) continue;

      const awareness = awarenessMap.get(player.player.id);
      if (!awareness) continue;

      const decisionCtx = new DecisionContext(state, player, awareness, tick, deltaTime);
      const decision = player.hasBall
        ? possessionDecisionSystem.decide(decisionCtx)
        : offBallDecisionSystem.decide(decisionCtx);

      // Continuous positional actions are applied as no-ops (no lifecycle).
      // Discrete actions start a full ActionExecution (PREPARING → …).
      actionFactory.tryStart(decision, player, state.currentSecond);
    }

    // 9. World systems.
    ballPhysics.update(state, deltaTime);
    tacticalEngine.update(state);
    teamBehaviour.update(state);
    movementSystem.update(state, deltaTime);
    possessionSystem.update(state);
    this.syncPossessionSide(state);

    void period;
    return events;
  }

  private syncPossessionSide(state: MatchState): void {
    const owner = state.ball.owner;
    if (!owner) return;
    const ownerIsHome = state.home.players.includes(owner);
    state.attackingTeam = ownerIsHome ? state.home : state.away;
    state.defendingTeam = ownerIsHome ? state.away : state.home;
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

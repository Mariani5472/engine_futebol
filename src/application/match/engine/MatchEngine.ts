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
import { DecisionSystem } from "../decision/DecisionSystem";
import { HoldBallEvaluator } from "../decision/evaluators/HoldBallEvaluator";
import { PassEvaluator } from "../decision/evaluators/PassEvaluator";
import { ShotEvaluator } from "../decision/evaluators/ShotEvaluator";
import { DribbleEvaluator } from "../decision/evaluators/DribbleEvaluator";
import { TackleEvaluator } from "../decision/evaluators/TackleEvaluator";
import { PressEvaluator } from "../decision/evaluators/PressEvaluator";
import { CoverEvaluator } from "../decision/evaluators/CoverEvaluator";
import { ActionFactory } from "../action/ActionFactory";
import { ActionContext } from "../action/ActionContext";
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

  public simulate(config: SimulationConfig): MatchResult {

    const rng = new SeededRandom(config.seed);
    const DELTA_TIME = config.tickDeltaSeconds ?? DEFAULT_DELTA_TIME;
    const MATCH_DURATION_SECONDS = config.maxDurationSeconds ?? DEFAULT_MATCH_DURATION_SECONDS;
    const HALF_TIME_SECONDS = MATCH_DURATION_SECONDS / 2;

    // Build all systems.
    const pitchGrid = PitchGrid.create(config.pitch);
    const perceptionSystem = new PerceptionSystem(pitchGrid);
    const cognitiveSystem = new CognitiveSystem(
      new NoiseSystem(rng),
      new MemorySystem(),
      new PredictionSystem()
    );
    const decisionSystem = new DecisionSystem(
      [
        new PassEvaluator(),
        new ShotEvaluator(),
        new DribbleEvaluator(),
        new HoldBallEvaluator(),
        new TackleEvaluator(),
        new PressEvaluator(),
        new CoverEvaluator(),
      ],
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
    while (state.currentSecond < MATCH_DURATION_SECONDS) {

      // Handle half time transition.
      if (!halfTimeHandled && state.currentSecond >= HALF_TIME_SECONDS) {
        allEvents.push(this.makePeriodEnded("FIRST_HALF", state.currentSecond));
        period = "SECOND_HALF";
        halfTimeHandled = true;
        allEvents.push(this.makePeriodStarted("SECOND_HALF", state.currentSecond));
        this.swapAttackingDirections(state);
      }

      const tickEvents = this.runTick(
        state, awarenessMap, rng,
        perceptionSystem, cognitiveSystem, decisionSystem,
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

      this.accumulateFatigue(state);
      state.currentSecond += DELTA_TIME;
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

  private runTick(
    state: MatchState,
    awarenessMap: Map<string, PlayerAwareness>,
    rng: Random,
    perceptionSystem: PerceptionSystem,
    cognitiveSystem: CognitiveSystem,
    decisionSystem: DecisionSystem,
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

    // 1. Perception — what can each player currently see.
    const perceptions = perceptionSystem.update(state);

    // 2. Cognition — update memory and predictions from perception.
    for (const player of this.allPlayers(state)) {
      const awareness = awarenessMap.get(player.player.id);
      const perception = perceptions.get(player.player.id);
      if (!awareness || !perception) continue;

      cognitiveSystem.update({
        player,
        awareness,
        perception,
        deltaTime: DELTA_TIME,
        tick
      } satisfies CognitiveContext);
    }

    // 3. Decision + Action — each player decides and acts.
    for (const player of this.allPlayers(state)) {
      const awareness = awarenessMap.get(player.player.id);
      if (!awareness) continue;

      const decisionCtx = new DecisionContext(state, player, awareness, tick, DELTA_TIME);
      const decision = decisionSystem.decide(decisionCtx);

      const isHome = state.home.players.includes(player);
      const teamState = isHome ? state.home : state.away;

      const actionCtx: ActionContext = {
        player,
        decision,
        match: state,
        pitch: state.pitch,
        random: rng,
        tick,
        deltaTime: DELTA_TIME,
        teamSide: isHome ? "HOME" : "AWAY",
        attackingDirection: teamState.attackingDirection,
        matchSecond: state.currentSecond
      };

      const result = actionFactory.execute(decision, actionCtx);
      events.push(...result.events);
    }

    // 4. Ball physics — apply gravity, friction, bounce.
    ballPhysics.update(state, DELTA_TIME);

    // 5. Tactical engine — set tactical target positions for all players.
    tacticalEngine.update(state);

    // 6. Team behaviour — press, mark, cover refinements.
    teamBehaviour.update(state);

    // 7. Movement — advance players toward their targets.
    movementSystem.update(state, DELTA_TIME);

    // 8. Possession — award ball to nearest eligible player.
    possessionSystem.update(state);

    // 9. Sync attacking/defending designation to possession.
    this.syncPossessionSide(state);

    void period; // used for event timestamping in sub-calls
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
    // TypeScript readonly: cast to mutable for the controlled mutation.
    const home = state.home as { attackingDirection: 1 | -1 };
    const away = state.away as { attackingDirection: 1 | -1 };
    home.attackingDirection = home.attackingDirection === 1 ? -1 : 1;
    away.attackingDirection = away.attackingDirection === 1 ? -1 : 1;
  }

  private accumulateFatigue(state: MatchState): void {
    for (const player of this.allPlayers(state)) {
      const workRate = player.player.attributes.mental.workRate / 20;
      const speed = player.velocity.magnitude();
      const activityFactor = 0.3 + speed * 0.05 + workRate * 0.2;
      player.fatigue = Math.min(100, player.fatigue + FATIGUE_RATE * activityFactor * DELTA_TIME);
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

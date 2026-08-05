import type { MatchEvent } from "../../../domain";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { MatchSession } from "../engine/MatchSession";
import type { SimulationConfig } from "../engine/SimulationConfig";
import type { ActorObservation } from "../observation/ObservationSpace";
import { commandDecision, type PlayerActionCommand } from "../policy/PlayerPolicy";
import { PLAYER_ACTION_SPACE, type PlayerActionMask } from "../policy/PlayerActionSpace";
import { DecisionGatePlayerPolicy } from "../policy/PlayerPolicies";
import type { CurriculumScenarioConfig } from "../scenario/MatchScenario";

export const MULTI_AGENT_MATCH_ENVIRONMENT_VERSION = 1 as const;

export interface MultiAgentMatchEnvironmentOptions {
  readonly playerIds: readonly string[];
  readonly configFactory: (seed: number) => SimulationConfig;
  readonly initialSeed?: number;
  readonly maxJointDecisionSteps?: number;
  readonly maxEpisodePhysicalTicks?: number;
  readonly maxPhysicalTicksPerStep?: number;
}

export interface MultiAgentRewardComponent {
  readonly id: "DECISION_COST" | "PASS_COMPLETED" | "GOAL" | "DRILL_SUCCESS" | "POSSESSION_LOST";
  readonly value: number;
  readonly eventId?: string;
}

export interface MultiAgentTransitionInfo {
  readonly seed: number;
  readonly jointDecisionStep: number;
  readonly physicalTicks: number;
  readonly totalPhysicalTicks: number;
  readonly matchSecond: number;
  readonly events: readonly MatchEvent[];
  readonly reason: "RUNNING" | "OBJECTIVE_COMPLETE" | "MATCH_FINISHED" | "DECISION_LIMIT" | "PHYSICAL_TICK_LIMIT" | "STEP_SAFETY_LIMIT";
}

export interface MultiAgentBoundary {
  readonly activeAgentIds: readonly string[];
  readonly observations: Readonly<Record<string, ActorObservation>>;
  readonly actionMasks: Readonly<Record<string, PlayerActionMask>>;
  readonly rewards: Readonly<Record<string, number>>;
  readonly rewardBreakdowns: Readonly<Record<string, readonly MultiAgentRewardComponent[]>>;
  readonly terminated: boolean;
  readonly truncated: boolean;
  readonly info: MultiAgentTransitionInfo;
}

/** Deterministic joint boundary for centralized, shared or self-play policies. */
export class MultiAgentMatchEnvironment {
  private session: MatchSession | null = null;
  private readonly gates = new Map<string, DecisionGatePlayerPolicy>();
  private readonly teamByPlayerId = new Map<string, string>();
  private seed: number;
  private jointDecisionSteps = 0;
  private totalPhysicalTicks = 0;
  private done = false;
  private scenario: CurriculumScenarioConfig | null = null;

  public constructor(private readonly options: MultiAgentMatchEnvironmentOptions) {
    if (options.playerIds.length === 0 || new Set(options.playerIds).size !== options.playerIds.length) {
      throw new Error("playerIds must contain unique controlled players");
    }
    this.seed = options.initialSeed ?? 1;
    this.validateLimit(options.maxJointDecisionSteps, "maxJointDecisionSteps");
    this.validateLimit(options.maxEpisodePhysicalTicks, "maxEpisodePhysicalTicks");
    this.validateLimit(options.maxPhysicalTicksPerStep, "maxPhysicalTicksPerStep");
  }

  public reset(seed = this.seed): MultiAgentBoundary {
    if (!Number.isInteger(seed)) throw new Error("Multi-agent seed must be an integer");
    this.seed = seed;
    this.jointDecisionSteps = 0;
    this.totalPhysicalTicks = 0;
    this.done = false;
    this.gates.clear();
    this.teamByPlayerId.clear();
    const requested = this.options.configFactory(seed);
    this.scenario = requested.scenario?.kind === "CURRICULUM" ? requested.scenario : null;
    for (const player of requested.homeTeam.players) this.teamByPlayerId.set(String(player.id), String(requested.homeTeam.id));
    for (const player of requested.awayTeam.players) this.teamByPlayerId.set(String(player.id), String(requested.awayTeam.id));
    this.session = MatchSession.create({ ...requested, seed, tickDeltaSeconds: ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds });
    for (const playerId of this.options.playerIds) {
      const gate = new DecisionGatePlayerPolicy(`multi-agent:${playerId}`);
      this.gates.set(playerId, gate);
      this.session.setPlayerPolicy(playerId, gate);
    }
    const physicalTicks = this.advanceUntilBoundary(this.stepLimit());
    return this.boundary(physicalTicks, [], false, false, "RUNNING", this.emptyRewards());
  }

  public step(actions: Readonly<Record<string, PlayerActionCommand>>): MultiAgentBoundary {
    if (this.done) throw new Error("Multi-agent episode is done; call reset() before step()");
    const active = this.activeAgentIds();
    const supplied = Object.keys(actions).sort();
    if (supplied.length !== active.length || supplied.some((id, index) => id !== [...active].sort()[index])) {
      throw new Error(`Actions must match active agents exactly: expected [${active.join(", ")}], received [${supplied.join(", ")}]`);
    }
    for (const playerId of active) {
      this.assertAllowed(actions[playerId], this.requireObservation(playerId).actionMask);
      this.gates.get(playerId)!.submit(actions[playerId]);
    }

    const events: MatchEvent[] = [];
    const session = this.requireSession();
    let physicalTicks = 0;
    let reason: MultiAgentTransitionInfo["reason"] = "RUNNING";
    while (!session.isFinished() && physicalTicks < this.stepLimit()) {
      session.advance(ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds);
      events.push(...session.latestEvents());
      physicalTicks++;
      this.totalPhysicalTicks++;
      if (this.totalPhysicalTicks >= (this.options.maxEpisodePhysicalTicks ?? Number.POSITIVE_INFINITY)) {
        reason = "PHYSICAL_TICK_LIMIT";
        break;
      }
      if (this.activeAgentIds().length > 0) break;
    }
    this.jointDecisionSteps++;
    const objectiveComplete = this.objectiveComplete(events);
    let terminated = session.isFinished() || objectiveComplete;
    let truncated = false;
    if (objectiveComplete) reason = "OBJECTIVE_COMPLETE";
    else if (session.isFinished()) reason = "MATCH_FINISHED";
    else if (reason === "PHYSICAL_TICK_LIMIT") truncated = true;
    else if (this.jointDecisionSteps >= (this.options.maxJointDecisionSteps ?? Number.POSITIVE_INFINITY)) {
      reason = "DECISION_LIMIT";
      truncated = true;
    } else if (this.activeAgentIds().length === 0) {
      reason = "STEP_SAFETY_LIMIT";
      truncated = true;
    }
    if (terminated) truncated = false;
    this.done = terminated || truncated;
    const rewards = this.rewards(events, objectiveComplete);
    return this.boundary(physicalTicks, events, terminated, truncated, reason, rewards);
  }

  public isDone(): boolean { return this.done; }

  private advanceUntilBoundary(limit: number): number {
    const session = this.requireSession();
    let ticks = 0;
    while (!session.isFinished() && this.activeAgentIds().length === 0 && ticks < limit) {
      session.advance(ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds);
      ticks++;
      this.totalPhysicalTicks++;
    }
    if (this.activeAgentIds().length === 0) throw new Error(`No controlled agent decision boundary within ${limit} physical ticks`);
    return ticks;
  }

  private boundary(
    physicalTicks: number,
    events: readonly MatchEvent[],
    terminated: boolean,
    truncated: boolean,
    reason: MultiAgentTransitionInfo["reason"],
    rewardData: { rewards: Record<string, number>; breakdowns: Record<string, readonly MultiAgentRewardComponent[]> },
  ): MultiAgentBoundary {
    const activeAgentIds = terminated || truncated ? [] : this.activeAgentIds();
    const observations: Record<string, ActorObservation> = {};
    const actionMasks: Record<string, PlayerActionMask> = {};
    for (const playerId of activeAgentIds) {
      const observation = this.requireObservation(playerId);
      observations[playerId] = observation;
      actionMasks[playerId] = observation.actionMask;
    }
    return Object.freeze({
      activeAgentIds: Object.freeze(activeAgentIds),
      observations: Object.freeze(observations),
      actionMasks: Object.freeze(actionMasks),
      rewards: Object.freeze(rewardData.rewards),
      rewardBreakdowns: Object.freeze(rewardData.breakdowns),
      terminated,
      truncated,
      info: Object.freeze({
        seed: this.seed,
        jointDecisionStep: this.jointDecisionSteps,
        physicalTicks,
        totalPhysicalTicks: this.totalPhysicalTicks,
        matchSecond: this.requireSession().matchSecond(),
        events: Object.freeze([...events]),
        reason,
      }),
    });
  }

  private rewards(events: readonly MatchEvent[], objectiveComplete: boolean) {
    const breakdowns: Record<string, MultiAgentRewardComponent[]> = Object.fromEntries(
      this.options.playerIds.map(id => [id, [{ id: "DECISION_COST" as const, value: -0.001 }]]),
    );
    const addTeam = (teamId: string, id: MultiAgentRewardComponent["id"], value: number, eventId?: string) => {
      for (const playerId of this.options.playerIds) {
        const signed = this.teamByPlayerId.get(playerId) === teamId ? value : -value;
        breakdowns[playerId].push({ id, value: signed, eventId });
      }
    };
    for (const event of events) {
      if (event.type === "GOAL") addTeam(String(event.teamId), "GOAL", 1, String(event.id));
      if (event.type === "PASS_COMPLETED") addTeam(String(event.teamId), "PASS_COMPLETED", 0.02, String(event.id));
    }
    if (objectiveComplete && this.scenario?.objective === "COMPLETE_PASS") {
      const teamId = this.teamByPlayerId.get(this.scenario.primaryBallCarrierId)!;
      addTeam(teamId, "DRILL_SUCCESS", 1);
    }
    if (objectiveComplete && this.scenario?.objective === "SCORE_GOAL"
      && !events.some(event => event.type === "GOAL")) {
      const defendingTeamId = this.teamByPlayerId.get(this.scenario.defendingPlayerIds[0]
        ?? this.scenario.defendingGoalkeeperId ?? "")!;
      if (defendingTeamId) addTeam(defendingTeamId, "POSSESSION_LOST", 0.35);
    }
    const rewards = Object.fromEntries(this.options.playerIds.map(id => [
      id, breakdowns[id].reduce((sum, component) => sum + component.value, 0),
    ]));
    return { rewards, breakdowns: Object.fromEntries(Object.entries(breakdowns).map(([id, items]) => [id, Object.freeze(items)])) };
  }

  private emptyRewards() {
    return {
      rewards: Object.fromEntries(this.options.playerIds.map(id => [id, 0])),
      breakdowns: Object.fromEntries(this.options.playerIds.map(id => [id, Object.freeze([])])),
    };
  }

  private objectiveComplete(events: readonly MatchEvent[]): boolean {
    if (!this.scenario) return false;
    if (this.scenario.objective === "COMPLETE_PASS") {
      return events.some(event => event.type === "PASS_COMPLETED"
        && event.playerId === this.scenario!.primaryBallCarrierId
        && this.scenario!.attackingPlayerIds.includes(String(event.controllingPlayerId)));
    }
    if (this.scenario.objective === "SCORE_GOAL") {
      const attackingTeamId = this.teamByPlayerId.get(this.scenario.primaryBallCarrierId);
      return events.some(event => event.type === "GOAL" && String(event.teamId) === attackingTeamId)
        || events.some(event => event.type === "POSSESSION_CHANGED"
          && String(event.teamId) !== attackingTeamId && !event.contested);
    }
    return false;
  }

  private activeAgentIds(): string[] {
    return [...this.gates.entries()].filter(([, gate]) => gate.isWaiting()).map(([id]) => id).sort();
  }

  private requireObservation(playerId: string): ActorObservation {
    const observation = this.requireSession().actorObservation(playerId);
    if (!observation) throw new Error(`No actor observation for controlled player ${playerId}`);
    return observation;
  }

  private assertAllowed(command: PlayerActionCommand, mask: PlayerActionMask): void {
    const requested = commandDecision(command);
    const action = PLAYER_ACTION_SPACE.actionForType(requested.type);
    const entry = mask.entries[action.index];
    if (!entry.enabled || !entry.validTargetIds.includes(requested.targetId ?? null)) {
      throw new Error(`Action ${action.id} is masked for ${mask.playerId}`);
    }
  }

  private requireSession(): MatchSession {
    if (!this.session) throw new Error("Multi-agent environment is not initialized; call reset() first");
    return this.session;
  }

  private stepLimit(): number { return this.options.maxPhysicalTicksPerStep ?? 10_000; }
  private validateLimit(value: number | undefined, name: string): void {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) throw new Error(`${name} must be a positive integer`);
  }
}

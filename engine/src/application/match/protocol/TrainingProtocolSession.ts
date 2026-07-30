import { ACTOR_OBSERVATION_VERSION } from "../observation/ObservationSpace";
import { PLAYER_ACTION_SPACE_VERSION } from "../policy/PlayerActionSpace";
import { REWARD_VERSION } from "../reward/RewardV1";
import { AttackerVsGoalkeeperEnvironment } from "../scenario/AttackerVsGoalkeeperEnvironment";
import { ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION } from "../scenario/MatchScenario";
import { PURE_MATCH_ENVIRONMENT_VERSION } from "../environment/PureMatchEnvironment";
import { MULTI_AGENT_MATCH_ENVIRONMENT_VERSION, MultiAgentMatchEnvironment } from "../environment/MultiAgentMatchEnvironment";
import { CURRICULUM_SCENARIO_VERSION, createCurriculumScenarioPreset } from "../scenario/MatchScenario";
import { createDefaultTrainingConfig } from "./DefaultTrainingConfig";
import {
  TRAINING_PROTOCOL_VERSION,
  type CreateEnvironmentPayload,
  type EnvironmentPayload,
  type ResetEnvironmentPayload,
  type StepEnvironmentPayload,
  type TrainingErrorResponse,
  type TrainingProtocolErrorCode,
  type TrainingRequest,
  type TrainingRequestType,
  type TrainingResponse,
} from "./TrainingProtocol";

export interface TrainingProtocolSessionOptions {
  readonly createEnvironment?: (payload: CreateEnvironmentPayload, environmentId: string) => AttackerVsGoalkeeperEnvironment | MultiAgentMatchEnvironment;
}

export class TrainingProtocolSession {
  private readonly environments = new Map<string, {
    readonly environment: AttackerVsGoalkeeperEnvironment | MultiAgentMatchEnvironment;
    readonly kind: CreateEnvironmentPayload["kind"];
    readonly wireFormat: "FULL" | "COMPACT";
  }>();
  private nextEnvironmentId = 1;
  private shutdown = false;

  public constructor(private readonly options: TrainingProtocolSessionOptions = {}) {}

  public handle(input: unknown): TrainingResponse {
    let requestId = "unknown";
    try {
      const request = this.parseRequest(input);
      requestId = request.requestId;
      if (request.protocolVersion !== TRAINING_PROTOCOL_VERSION) {
        return this.failure(requestId, "UNSUPPORTED_VERSION", `Protocol version ${request.protocolVersion} is unsupported; expected ${TRAINING_PROTOCOL_VERSION}`, false);
      }
      switch (request.type) {
        case "HELLO": return this.success(request, this.hello());
        case "CREATE": return this.create(request as TrainingRequest<CreateEnvironmentPayload>);
        case "RESET": return this.reset(request as TrainingRequest<ResetEnvironmentPayload>);
        case "STEP": return this.step(request as TrainingRequest<StepEnvironmentPayload>);
        case "CLOSE_ENV": return this.closeEnvironment(request as TrainingRequest<EnvironmentPayload>);
        case "SHUTDOWN":
          this.environments.clear();
          this.shutdown = true;
          return this.success(request, { shutdown: true });
        default: return this.failure(requestId, "UNKNOWN_REQUEST_TYPE", `Unknown request type: ${String(request.type)}`, true);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.failure(requestId, "INVALID_REQUEST", message, true);
    }
  }

  public isShutdownRequested(): boolean { return this.shutdown; }
  public environmentCount(): number { return this.environments.size; }

  private create(request: TrainingRequest<CreateEnvironmentPayload>): TrainingResponse {
    const object = this.objectPayload(request.payload);
    const payload = object as unknown as CreateEnvironmentPayload;
    if (payload.kind !== "ATTACKER_VS_GOALKEEPER" && payload.kind !== "CURRICULUM") {
      return this.failure(request.requestId, "INVALID_REQUEST", `Unsupported environment kind: ${String(payload.kind)}`, true);
    }
    const environmentId = this.optionalString(payload.environmentId, "environmentId") ?? `environment-${this.nextEnvironmentId++}`;
    if (this.environments.has(environmentId)) {
      return this.failure(request.requestId, "ENVIRONMENT_EXISTS", `Environment ${environmentId} already exists`, true);
    }
    try {
      const environment = (this.options.createEnvironment ?? defaultEnvironment)(payload, environmentId);
      const wireFormat = payload.wireFormat ?? "FULL";
      if (wireFormat !== "FULL" && wireFormat !== "COMPACT") throw new Error(`Unsupported wireFormat: ${String(wireFormat)}`);
      this.environments.set(environmentId, { environment, kind: payload.kind, wireFormat });
      return this.success(request, { environmentId, kind: payload.kind, wireFormat });
    } catch (error) {
      return this.environmentFailure(request.requestId, error);
    }
  }

  private reset(request: TrainingRequest<ResetEnvironmentPayload>): TrainingResponse {
    const payload = this.environmentPayload(request.payload);
    const record = this.environments.get(payload.environmentId);
    if (!record) return this.notFound(request.requestId, payload.environmentId);
    try {
      const result = record.environment.reset(payload.seed);
      return this.success(request, record.wireFormat === "COMPACT" ? compactAnyResult(result) : result);
    } catch (error) {
      return this.environmentFailure(request.requestId, error);
    }
  }

  private step(request: TrainingRequest<StepEnvironmentPayload>): TrainingResponse {
    const payload = this.environmentPayload(request.payload) as StepEnvironmentPayload;
    const record = this.environments.get(payload.environmentId);
    if (!record) return this.notFound(request.requestId, payload.environmentId);
    try {
      const result = record.kind === "CURRICULUM"
        ? (record.environment as MultiAgentMatchEnvironment).step(requireActions(payload.actions))
        : (record.environment as AttackerVsGoalkeeperEnvironment).step(requireAction(payload.action));
      return this.success(request, record.wireFormat === "COMPACT" ? compactAnyResult(result) : result);
    } catch (error) {
      return this.environmentFailure(request.requestId, error);
    }
  }

  private closeEnvironment(request: TrainingRequest<EnvironmentPayload>): TrainingResponse {
    const { environmentId } = this.environmentPayload(request.payload);
    if (!this.environments.delete(environmentId)) return this.notFound(request.requestId, environmentId);
    return this.success(request, { environmentId, closed: true });
  }

  private hello(): unknown {
    return Object.freeze({
      protocolVersion: TRAINING_PROTOCOL_VERSION,
      observationVersion: ACTOR_OBSERVATION_VERSION,
      actionSpaceVersion: PLAYER_ACTION_SPACE_VERSION,
      rewardVersion: REWARD_VERSION,
      environmentVersion: PURE_MATCH_ENVIRONMENT_VERSION,
      scenarioVersion: ATTACKER_VS_GOALKEEPER_SCENARIO_VERSION,
      curriculumScenarioVersion: CURRICULUM_SCENARIO_VERSION,
      multiAgentEnvironmentVersion: MULTI_AGENT_MATCH_ENVIRONMENT_VERSION,
      capabilities: Object.freeze(["persistent_process", "multiple_environments", "attacker_vs_goalkeeper", "curriculum", "multi_agent", "shared_policy", "self_play", "action_mask", "reward_breakdown", "compact_wire_format"]),
    });
  }

  private parseRequest(input: unknown): TrainingRequest {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Request must be a JSON object");
    const request = input as Partial<TrainingRequest>;
    if (!Number.isInteger(request.protocolVersion)) throw new Error("protocolVersion must be an integer");
    if (typeof request.requestId !== "string" || request.requestId.length === 0) throw new Error("requestId must be a non-empty string");
    if (typeof request.type !== "string") throw new Error("type must be a string");
    return request as TrainingRequest;
  }

  private environmentPayload(payload: unknown): ResetEnvironmentPayload {
    const object = this.objectPayload(payload);
    if (typeof object.environmentId !== "string" || object.environmentId.length === 0) throw new Error("environmentId must be a non-empty string");
    if (object.seed !== undefined && !Number.isInteger(object.seed)) throw new Error("seed must be an integer");
    return object as unknown as ResetEnvironmentPayload;
  }

  private objectPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("payload must be an object");
    return payload as Record<string, unknown>;
  }

  private optionalString(value: unknown, name: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value.length === 0) throw new Error(`${name} must be a non-empty string`);
    return value;
  }

  private success<T>(request: TrainingRequest, payload: T): TrainingResponse<T> {
    return Object.freeze({ protocolVersion: TRAINING_PROTOCOL_VERSION, requestId: request.requestId, ok: true, type: request.type, payload });
  }

  private notFound(requestId: string, environmentId: string): TrainingErrorResponse {
    return this.failure(requestId, "ENVIRONMENT_NOT_FOUND", `Environment ${environmentId} was not found`, true);
  }

  private environmentFailure(requestId: string, error: unknown): TrainingErrorResponse {
    return this.failure(requestId, "ENVIRONMENT_ERROR", error instanceof Error ? error.message : String(error), true);
  }

  private failure(requestId: string, code: TrainingProtocolErrorCode, message: string, recoverable: boolean): TrainingErrorResponse {
    return Object.freeze({ protocolVersion: TRAINING_PROTOCOL_VERSION, requestId, ok: false, type: "ERROR", error: Object.freeze({ code, message, recoverable }) });
  }
}

function compactResult(result: any): unknown {
  const observation = result.observation;
  const mask = result.actionMask;
  const info = result.info;
  return Object.freeze({
    observation: Object.freeze({ kind: observation.kind, version: observation.version, vector: observation.vector }),
    actionMask: Object.freeze({
      version: mask.version,
      playerId: mask.playerId,
      matchSecond: mask.matchSecond,
      bits: mask.bits,
      entries: Object.freeze(mask.entries.map((entry: any) => Object.freeze({
        id: entry.id,
        index: entry.index,
        enabled: entry.enabled,
        validTargetIds: entry.validTargetIds,
      }))),
    }),
    reward: result.reward,
    rewardBreakdown: result.rewardBreakdown,
    outcome: result.outcome,
    terminated: result.terminated,
    truncated: result.truncated,
    goalkeeperPosition: result.goalkeeperPosition,
    scenarioVersion: result.scenarioVersion,
    info: Object.freeze({
      seed: info.seed,
      playerId: info.playerId,
      decisionStep: info.decisionStep,
      physicalTicks: info.physicalTicks,
      totalPhysicalTicks: info.totalPhysicalTicks,
      matchSecond: info.matchSecond,
      reason: info.reason,
    }),
  });
}

function compactAnyResult(result: any): unknown {
  if (Array.isArray(result.activeAgentIds)) {
    const observations = Object.fromEntries(Object.entries(result.observations).map(([id, value]: [string, any]) => [id, {
      kind: value.kind, version: value.version, vector: value.vector,
    }]));
    const actionMasks = Object.fromEntries(Object.entries(result.actionMasks).map(([id, value]: [string, any]) => [id, {
      version: value.version,
      playerId: value.playerId,
      matchSecond: value.matchSecond,
      bits: value.bits,
      entries: value.entries.map((entry: any) => ({ id: entry.id, index: entry.index, enabled: entry.enabled, validTargetIds: entry.validTargetIds })),
    }]));
    return Object.freeze({ ...result, observations: Object.freeze(observations), actionMasks: Object.freeze(actionMasks), info: Object.freeze({ ...result.info, events: undefined }) });
  }
  return compactResult(result);
}

function defaultEnvironment(payload: CreateEnvironmentPayload, environmentId: string): AttackerVsGoalkeeperEnvironment | MultiAgentMatchEnvironment {
  const seed = payload.seed ?? 1;
  if (payload.kind === "CURRICULUM") {
    if (!payload.stage) throw new Error("CURRICULUM requires a stage");
    const scenario = createCurriculumScenarioPreset(payload.stage);
    const playerIds = payload.playerIds ?? defaultControlledPlayers(scenario);
    return new MultiAgentMatchEnvironment({
      playerIds,
      initialSeed: seed,
      configFactory: value => ({ ...createDefaultTrainingConfig(`training:${environmentId}:${value}`, value), scenario }),
      maxJointDecisionSteps: payload.maxJointDecisionSteps ?? 100,
      maxEpisodePhysicalTicks: payload.maxEpisodePhysicalTicks ?? 108_000,
      maxPhysicalTicksPerStep: payload.maxPhysicalTicksPerStep ?? 2_000,
    });
  }
  return new AttackerVsGoalkeeperEnvironment({
    attackerId: payload.attackerId ?? "home-10",
    goalkeeperId: payload.goalkeeperId ?? "away-1",
    initialSeed: seed,
    configFactory: value => createDefaultTrainingConfig(`training:${environmentId}:${value}`, value),
    scenario: payload.scenario,
    maxDecisionSteps: payload.maxDecisionSteps ?? 20,
    maxEpisodePhysicalTicks: payload.maxEpisodePhysicalTicks ?? 2_000,
    maxPhysicalTicksPerStep: payload.maxPhysicalTicksPerStep ?? 1_000,
  });
}

function defaultControlledPlayers(scenario: ReturnType<typeof createCurriculumScenarioPreset>): readonly string[] {
  if (scenario.stage === "LEARNED_GOALKEEPER") return scenario.defendingGoalkeeperId ? [scenario.defendingGoalkeeperId] : [];
  if (scenario.stage === "SELF_PLAY") return [scenario.attackingGoalkeeperId!, ...scenario.attackingPlayerIds, scenario.defendingGoalkeeperId!, ...scenario.defendingPlayerIds];
  return [...(scenario.attackingGoalkeeperId ? [scenario.attackingGoalkeeperId] : []), ...scenario.attackingPlayerIds];
}

function requireAction(action: unknown): import("../policy/PlayerPolicy").PlayerActionCommand {
  if (!action || typeof action !== "object") throw new Error("STEP requires an action object");
  return action as import("../policy/PlayerPolicy").PlayerActionCommand;
}

function requireActions(actions: unknown): Readonly<Record<string, import("../policy/PlayerPolicy").PlayerActionCommand>> {
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) throw new Error("Multi-agent STEP requires an actions object keyed by active player ID");
  return actions as Readonly<Record<string, import("../policy/PlayerPolicy").PlayerActionCommand>>;
}

import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import type { AttackerVsGoalkeeperScenarioConfig, CurriculumScenarioStage } from "../scenario/MatchScenario";

export const TRAINING_PROTOCOL_VERSION = 1 as const;

export type TrainingRequestType = "HELLO" | "CREATE" | "RESET" | "STEP" | "CLOSE_ENV" | "SHUTDOWN";

export interface TrainingRequest<T = unknown> {
  readonly protocolVersion: number;
  readonly requestId: string;
  readonly type: TrainingRequestType;
  readonly payload?: T;
}

export interface CreateEnvironmentPayload {
  readonly environmentId?: string;
  readonly kind: "ATTACKER_VS_GOALKEEPER" | "CURRICULUM";
  readonly seed?: number;
  readonly attackerId?: string;
  readonly goalkeeperId?: string;
  readonly scenario?: Omit<AttackerVsGoalkeeperScenarioConfig, "kind" | "version" | "attackerId" | "goalkeeperId">;
  readonly maxDecisionSteps?: number;
  readonly maxEpisodePhysicalTicks?: number;
  readonly maxPhysicalTicksPerStep?: number;
  readonly wireFormat?: "FULL" | "COMPACT";
  readonly stage?: CurriculumScenarioStage;
  readonly playerIds?: readonly string[];
  readonly maxJointDecisionSteps?: number;
}

export interface EnvironmentPayload {
  readonly environmentId: string;
}

export interface ResetEnvironmentPayload extends EnvironmentPayload {
  readonly seed?: number;
}

export interface StepEnvironmentPayload extends EnvironmentPayload {
  readonly action?: PlayerActionCommand;
  readonly actions?: Readonly<Record<string, PlayerActionCommand>>;
}

export type TrainingProtocolErrorCode =
  | "INVALID_JSON"
  | "INVALID_REQUEST"
  | "UNSUPPORTED_VERSION"
  | "UNKNOWN_REQUEST_TYPE"
  | "ENVIRONMENT_EXISTS"
  | "ENVIRONMENT_NOT_FOUND"
  | "ENVIRONMENT_ERROR"
  | "INTERNAL_ERROR";

export interface TrainingProtocolError {
  readonly code: TrainingProtocolErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly details?: unknown;
}

export interface TrainingSuccessResponse<T = unknown> {
  readonly protocolVersion: typeof TRAINING_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: true;
  readonly type: TrainingRequestType;
  readonly payload: T;
}

export interface TrainingErrorResponse {
  readonly protocolVersion: typeof TRAINING_PROTOCOL_VERSION;
  readonly requestId: string;
  readonly ok: false;
  readonly type: "ERROR";
  readonly error: TrainingProtocolError;
}

export type TrainingResponse<T = unknown> = TrainingSuccessResponse<T> | TrainingErrorResponse;

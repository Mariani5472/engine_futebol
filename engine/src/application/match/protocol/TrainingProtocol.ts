import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import type { AttackerVsGoalkeeperScenarioConfig, CurriculumScenarioStage, FundamentalScenarioSkill } from "../scenario/MatchScenario";
import type {
  FundamentalBaselineId,
  FundamentalPartitionEvidence,
  FundamentalPromotionCriteria,
  FundamentalSeedPartitionCounts,
  FundamentalSeedPartitions,
} from "../curriculum/FundamentalTraining";

export const TRAINING_PROTOCOL_VERSION = 1 as const;

export type TrainingRequestType = "HELLO" | "CREATE" | "RESET" | "STEP" | "FUNDAMENTAL_PLAN" | "FUNDAMENTAL_GATE" | "CLOSE_ENV" | "SHUTDOWN";

export interface TrainingRequest<T = unknown> {
  readonly protocolVersion: number;
  readonly requestId: string;
  readonly type: TrainingRequestType;
  readonly payload?: T;
}

export interface CreateEnvironmentPayload {
  readonly environmentId?: string;
  readonly kind: "ATTACKER_VS_GOALKEEPER" | "FUNDAMENTAL" | "CURRICULUM";
  readonly seed?: number;
  readonly attackerId?: string;
  readonly goalkeeperId?: string;
  readonly scenario?: Omit<AttackerVsGoalkeeperScenarioConfig, "kind" | "version" | "attackerId" | "goalkeeperId">;
  readonly maxDecisionSteps?: number;
  readonly maxEpisodePhysicalTicks?: number;
  readonly maxPhysicalTicksPerStep?: number;
  readonly wireFormat?: "FULL" | "COMPACT";
  readonly stage?: CurriculumScenarioStage;
  readonly skill?: FundamentalScenarioSkill;
  readonly playerIds?: readonly string[];
  readonly maxJointDecisionSteps?: number;
  readonly difficultyLevel?: number;
  readonly rehearsalLevels?: readonly number[];
  readonly rehearsalRate?: number;
}

export interface FundamentalPlanPayload {
  readonly rootSeed: number;
  readonly counts?: FundamentalSeedPartitionCounts;
}

export interface FundamentalGatePayload {
  readonly skill: FundamentalScenarioSkill;
  readonly baselineId: FundamentalBaselineId;
  readonly seedPartitions: FundamentalSeedPartitions;
  readonly evidence: readonly FundamentalPartitionEvidence[];
  readonly confidence?: number;
  readonly criteria?: FundamentalPromotionCriteria;
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

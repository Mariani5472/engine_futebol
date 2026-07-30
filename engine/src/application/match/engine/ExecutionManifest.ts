import { createHash } from "node:crypto";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { resolveInstrumentation, type ResolvedInstrumentation } from "../instrumentation/TrainingInstrumentation";
import type { SimulationConfig } from "./SimulationConfig";

export interface EnvironmentVersions {
  readonly engine: string;
  readonly physics: number;
  readonly observation: number;
  readonly actionSpace: number;
  readonly policy: number;
  readonly reward: number;
  readonly rules: number;
  readonly scenario: number;
  readonly statistics: number;
  readonly rng: number;
  readonly protocol: number;
  readonly environment: number;
  readonly evaluation: number;
  readonly trainingProtocol: number;
  readonly performanceProfile: number;
  readonly curriculum: number;
  readonly multiAgentEnvironment: number;
  readonly opponentPool: number;
}

export const ENVIRONMENT_VERSIONS: EnvironmentVersions = Object.freeze({
  engine: "0.1.0",
  physics: 1,
  observation: 2,
  actionSpace: 2,
  policy: 1,
  reward: 1,
  rules: 1,
  scenario: 2,
  statistics: 1,
  rng: 1,
  protocol: 1,
  environment: 1,
  evaluation: 1,
  trainingProtocol: 1,
  performanceProfile: 1,
  curriculum: 1,
  multiAgentEnvironment: 1,
  opponentPool: 1,
});

export interface ExecutionManifest {
  readonly manifestVersion: 1;
  readonly versions: EnvironmentVersions;
  readonly matchId: string;
  readonly seed: number;
  readonly tickDeltaSeconds: number;
  readonly maxDurationSeconds: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly configurationHash: string;
  readonly instrumentationHash: string;
  readonly manifestHash: string;
  readonly reproductionKey: string;
  readonly instrumentation: ResolvedInstrumentation;
}

export interface SportingResultFingerprintInput {
  readonly seed: number;
  readonly matchDurationSeconds: number;
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly homeScore: number;
  readonly awayScore: number;
  readonly authoritativeEvents: readonly unknown[];
  readonly teamAnalytics: unknown;
}

export function buildExecutionManifest(
  config: SimulationConfig,
  instrumentation: ResolvedInstrumentation,
): ExecutionManifest {
  const tickDeltaSeconds = config.tickDeltaSeconds ?? ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;
  const maxDurationSeconds = config.maxDurationSeconds ?? 90 * 60;
  const { instrumentation: _selection, debugDecisions: _legacyDebug, ...simulationConfig } = config;
  const configurationHash = sha256({ ...simulationConfig, tickDeltaSeconds, maxDurationSeconds });
  const instrumentationHash = sha256(instrumentation);
  const unsigned = {
    manifestVersion: 1 as const,
    versions: ENVIRONMENT_VERSIONS,
    matchId: String(config.id),
    seed: config.seed,
    tickDeltaSeconds,
    maxDurationSeconds,
    homeTeamId: String(config.homeTeam.id),
    awayTeamId: String(config.awayTeam.id),
    configurationHash,
    instrumentationHash,
    instrumentation,
  };
  const manifestHash = sha256(unsigned);
  return {
    ...unsigned,
    manifestHash,
    reproductionKey: `match-env:${ENVIRONMENT_VERSIONS.engine}:${manifestHash}`,
  };
}

export function verifyExecutionManifest(config: SimulationConfig, expected: ExecutionManifest): boolean {
  const resolved = resolveInstrumentation(config.instrumentation, config.debugDecisions);
  return buildExecutionManifest(config, resolved).manifestHash === expected.manifestHash;
}

/** Hash independent of the publication profile, suitable for replay verification. */
export function buildSportingResultHash(input: SportingResultFingerprintInput): string {
  return sha256(input);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (value === undefined) return { $type: "undefined" };
  if (typeof value === "number" && !Number.isFinite(value)) return { $type: String(value) };
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) result[key] = canonicalize(source[key]);
  return result;
}

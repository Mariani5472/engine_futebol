import type { PlayerActionCommand } from "../policy/PlayerPolicy";
import type {
  AttackerVsGoalkeeperEnvironment,
  AttackerVsGoalkeeperResetResult,
  AttackerVsGoalkeeperStepResult,
} from "../scenario/AttackerVsGoalkeeperEnvironment";

export const TRAINING_PERFORMANCE_PROFILE_VERSION = 1 as const;

export interface TrainingProfilerOptions {
  readonly environmentCounts: readonly number[];
  readonly episodesPerEnvironment: number;
  readonly seedStart?: number;
  readonly warmupEpisodes?: number;
}

export interface TrainingScaleProfile {
  readonly environments: number;
  readonly episodes: number;
  readonly decisions: number;
  readonly physicalTicks: number;
  readonly wallMilliseconds: number;
  readonly resetMilliseconds: number;
  readonly stepMilliseconds: number;
  readonly serializationMilliseconds: number;
  readonly serializationRatio: number;
  readonly episodesPerSecond: number;
  readonly decisionsPerSecond: number;
  readonly physicalTicksPerSecond: number;
  readonly averagePayloadBytes: number;
  readonly heapDeltaBytes: number;
  readonly transportRecommendation: "KEEP_JSON" | "CONSIDER_BINARY";
}

export interface TrainingPerformanceReport {
  readonly version: typeof TRAINING_PERFORMANCE_PROFILE_VERSION;
  readonly generatedAt: string;
  readonly profiles: readonly TrainingScaleProfile[];
}

/** Profiles interleaved environments in one process without changing physics. */
export class TrainingEnvironmentProfiler {
  public constructor(
    private readonly environmentFactory: (seed: number, index: number) => AttackerVsGoalkeeperEnvironment,
  ) {}

  public run(options: TrainingProfilerOptions): TrainingPerformanceReport {
    this.validate(options);
    const profiles = options.environmentCounts.map(count => this.profileScale(count, options));
    return Object.freeze({
      version: TRAINING_PERFORMANCE_PROFILE_VERSION,
      generatedAt: new Date().toISOString(),
      profiles: Object.freeze(profiles),
    });
  }

  private profileScale(environmentCount: number, options: TrainingProfilerOptions): TrainingScaleProfile {
    const seedStart = options.seedStart ?? 70_000;
    const environments = Array.from({ length: environmentCount }, (_, index) =>
      this.environmentFactory(seedStart + index, index));
    const warmups = options.warmupEpisodes ?? 1;
    for (let warmup = 0; warmup < warmups; warmup++) {
      environments.forEach((environment, index) => this.runEpisode(environment, seedStart + 100_000 + warmup * environmentCount + index, false));
    }

    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    let resetMilliseconds = 0;
    let stepMilliseconds = 0;
    let serializationMilliseconds = 0;
    let payloadBytes = 0;
    let decisions = 0;
    let physicalTicks = 0;
    for (let episode = 0; episode < options.episodesPerEnvironment; episode++) {
      environments.forEach((environment, index) => {
        const measurement = this.runEpisode(environment, seedStart + episode * environmentCount + index, true);
        resetMilliseconds += measurement.resetMilliseconds;
        stepMilliseconds += measurement.stepMilliseconds;
        serializationMilliseconds += measurement.serializationMilliseconds;
        payloadBytes += measurement.payloadBytes;
        decisions += measurement.decisions;
        physicalTicks += measurement.physicalTicks;
      });
    }
    const wallMilliseconds = performance.now() - started;
    const heapDeltaBytes = process.memoryUsage().heapUsed - heapBefore;
    const episodes = environmentCount * options.episodesPerEnvironment;
    const seconds = wallMilliseconds / 1_000;
    const serializationRatio = wallMilliseconds > 0 ? serializationMilliseconds / wallMilliseconds : 0;
    const averagePayloadBytes = payloadBytes / Math.max(1, decisions + episodes);
    return Object.freeze({
      environments: environmentCount,
      episodes,
      decisions,
      physicalTicks,
      wallMilliseconds,
      resetMilliseconds,
      stepMilliseconds,
      serializationMilliseconds,
      serializationRatio,
      episodesPerSecond: episodes / seconds,
      decisionsPerSecond: decisions / seconds,
      physicalTicksPerSecond: physicalTicks / seconds,
      averagePayloadBytes,
      heapDeltaBytes,
      transportRecommendation: serializationRatio >= 0.15 || averagePayloadBytes >= 65_536
        ? "CONSIDER_BINARY" : "KEEP_JSON",
    });
  }

  private runEpisode(environment: AttackerVsGoalkeeperEnvironment, seed: number, measure: boolean) {
    const resetStarted = performance.now();
    let boundary: AttackerVsGoalkeeperResetResult | AttackerVsGoalkeeperStepResult = environment.reset(seed);
    const resetMilliseconds = performance.now() - resetStarted;
    let serializationMilliseconds = 0;
    let payloadBytes = 0;
    if (measure) {
      const serialized = this.serialize(boundary);
      serializationMilliseconds += serialized.milliseconds;
      payloadBytes += serialized.bytes;
    }
    let decisions = 0;
    let physicalTicks = boundary.info.physicalTicks;
    let stepMilliseconds = 0;
    while (!environment.isDone()) {
      const command = this.command(boundary);
      const stepStarted = performance.now();
      boundary = environment.step(command);
      stepMilliseconds += performance.now() - stepStarted;
      decisions++;
      physicalTicks += boundary.info.physicalTicks;
      if (measure) {
        const serialized = this.serialize(boundary);
        serializationMilliseconds += serialized.milliseconds;
        payloadBytes += serialized.bytes;
      }
    }
    return { resetMilliseconds, stepMilliseconds, serializationMilliseconds, payloadBytes, decisions, physicalTicks };
  }

  private command(boundary: AttackerVsGoalkeeperResetResult | AttackerVsGoalkeeperStepResult): PlayerActionCommand {
    const shot = boundary.actionMask.entries.find(entry => entry.id === "SHOT" && entry.enabled);
    const entry = shot ?? boundary.actionMask.entries.find(candidate => candidate.enabled && candidate.id !== "NONE");
    if (!entry) throw new Error("Profiler found no valid action");
    const target = entry.validTargetIds[0];
    return target === null || target === undefined ? { actionId: entry.id } : { actionId: entry.id, targetId: target };
  }

  private serialize(value: unknown): { milliseconds: number; bytes: number } {
    const started = performance.now();
    const json = JSON.stringify(value);
    return { milliseconds: performance.now() - started, bytes: Buffer.byteLength(json, "utf8") };
  }

  private validate(options: TrainingProfilerOptions): void {
    if (options.environmentCounts.length === 0 || options.environmentCounts.some(value => !Number.isInteger(value) || value <= 0)) {
      throw new Error("environmentCounts must contain positive integers");
    }
    if (!Number.isInteger(options.episodesPerEnvironment) || options.episodesPerEnvironment <= 0) {
      throw new Error("episodesPerEnvironment must be a positive integer");
    }
    if (options.warmupEpisodes !== undefined && (!Number.isInteger(options.warmupEpisodes) || options.warmupEpisodes < 0)) {
      throw new Error("warmupEpisodes must be a non-negative integer");
    }
  }
}

import {
  buildExecutionManifest,
  verifyExecutionManifest,
} from "../../../src/application/match/engine/ExecutionManifest";
import {
  instrumentationProfile,
  resolveInstrumentation,
} from "../../../src/application/match/instrumentation/TrainingInstrumentation";
import { buildSimulationConfig } from "../../helpers/builders";

describe("ExecutionManifest", () => {
  it("produces stable SHA-256 hashes for the same execution contract", () => {
    const config = { ...buildSimulationConfig(12), tickDeltaSeconds: 0.05, maxDurationSeconds: 90 };
    const instrumentation = resolveInstrumentation({ profile: "EVALUATION" });
    const first = buildExecutionManifest(config, instrumentation);
    const second = buildExecutionManifest(config, instrumentation);

    expect(second).toEqual(first);
    expect(first.configurationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.manifestHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.reproductionKey).toContain(first.manifestHash);
    expect(verifyExecutionManifest(config, first)).toBe(true);
  });

  it("separates sporting configuration hash from instrumentation hash", () => {
    const base = buildSimulationConfig(12);
    const evaluationConfig = { ...base, instrumentation: { profile: "EVALUATION" as const } };
    const benchmarkConfig = { ...base, instrumentation: { profile: "BENCHMARK" as const } };
    const evaluation = buildExecutionManifest(evaluationConfig, resolveInstrumentation(evaluationConfig.instrumentation));
    const benchmark = buildExecutionManifest(benchmarkConfig, resolveInstrumentation(benchmarkConfig.instrumentation));

    expect(benchmark.configurationHash).toBe(evaluation.configurationHash);
    expect(benchmark.instrumentationHash).not.toBe(evaluation.instrumentationHash);
    expect(benchmark.manifestHash).not.toBe(evaluation.manifestHash);
    expect(verifyExecutionManifest(benchmarkConfig, evaluation)).toBe(false);
  });

  it("invalidates reproduction when a sporting input changes", () => {
    const config = buildSimulationConfig(12);
    const instrumentation = resolveInstrumentation();
    const manifest = buildExecutionManifest(config, instrumentation);
    expect(verifyExecutionManifest({ ...config, seed: 13 }, manifest)).toBe(false);
  });

  it("includes scenario geometry in the reproducibility contract", () => {
    const base = buildSimulationConfig(12);
    const scenario = {
      kind: "ATTACKER_VS_GOALKEEPER" as const,
      version: 1 as const,
      attackerId: "home-10",
      goalkeeperId: "away-1",
      attackerDistanceFromGoal: 18,
    };
    const firstConfig = { ...base, scenario };
    const secondConfig = { ...base, scenario: { ...scenario, attackerDistanceFromGoal: 14 } };
    const first = buildExecutionManifest(firstConfig, resolveInstrumentation());
    const second = buildExecutionManifest(secondConfig, resolveInstrumentation());

    expect(second.configurationHash).not.toBe(first.configurationHash);
    expect(verifyExecutionManifest(secondConfig, first)).toBe(false);
  });

  it("resolves the four documented profiles and explicit overrides", () => {
    expect(instrumentationProfile("DEBUG").debugSnapshots).toBe(true);
    expect(instrumentationProfile("EVALUATION").eventHistory).toBe(true);
    expect(instrumentationProfile("TRAINING").experienceRecording).toBe(true);
    expect(instrumentationProfile("BENCHMARK").replay).toBe(false);
    expect(resolveInstrumentation({
      profile: "BENCHMARK",
      overrides: { timeline: true },
    }).timeline).toBe(true);
  });
});

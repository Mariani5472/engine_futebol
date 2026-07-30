import { TrainingEnvironmentProfiler } from "../../../src/application/match/performance/TrainingEnvironmentProfiler";
import { AttackerVsGoalkeeperEnvironment } from "../../../src/application/match/scenario/AttackerVsGoalkeeperEnvironment";
import { buildSimulationConfig } from "../../helpers/builders";

describe("TrainingEnvironmentProfiler", () => {
  it("measures gradual scale without changing the fixed-step environment", () => {
    const profiler = new TrainingEnvironmentProfiler(seed => new AttackerVsGoalkeeperEnvironment({
      attackerId: "home-10",
      goalkeeperId: "away-1",
      initialSeed: seed,
      configFactory: value => ({ ...buildSimulationConfig(value), maxDurationSeconds: 60 }),
      maxDecisionSteps: 5,
      maxEpisodePhysicalTicks: 500,
      maxPhysicalTicksPerStep: 500,
    }));
    const report = profiler.run({ environmentCounts: [1, 2], episodesPerEnvironment: 1, warmupEpisodes: 0 });
    expect(report.version).toBe(1);
    expect(report.profiles.map(profile => profile.environments)).toEqual([1, 2]);
    for (const profile of report.profiles) {
      expect(profile.episodes).toBe(profile.environments);
      expect(profile.decisions).toBeGreaterThan(0);
      expect(profile.physicalTicks).toBeGreaterThan(0);
      expect(profile.averagePayloadBytes).toBeGreaterThan(0);
      expect(profile.episodesPerSecond).toBeGreaterThan(0);
      expect(["KEEP_JSON", "CONSIDER_BINARY"]).toContain(profile.transportRecommendation);
    }
  });

  it("rejects invalid scale plans", () => {
    const profiler = new TrainingEnvironmentProfiler(() => { throw new Error("unused"); });
    expect(() => profiler.run({ environmentCounts: [], episodesPerEnvironment: 1 })).toThrow(/environmentCounts/);
    expect(() => profiler.run({ environmentCounts: [1], episodesPerEnvironment: 0 })).toThrow(/episodesPerEnvironment/);
  });
});

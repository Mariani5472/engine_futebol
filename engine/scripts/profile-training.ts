import { AttackerVsGoalkeeperEnvironment } from "../src/application/match/scenario/AttackerVsGoalkeeperEnvironment";
import { createDefaultTrainingConfig } from "../src/application/match/protocol/DefaultTrainingConfig";
import { TrainingEnvironmentProfiler } from "../src/application/match/performance/TrainingEnvironmentProfiler";

const counts = argument("environments", "1,2,4,8").split(",").map(Number);
const episodes = Number(argument("episodes", "5"));
const warmups = Number(argument("warmups", "1"));
const profiler = new TrainingEnvironmentProfiler((seed, index) => new AttackerVsGoalkeeperEnvironment({
  attackerId: "home-10",
  goalkeeperId: "away-1",
  initialSeed: seed,
  configFactory: value => createDefaultTrainingConfig(`profile:${index}:${value}`, value),
  maxDecisionSteps: 20,
  maxEpisodePhysicalTicks: 2_000,
  maxPhysicalTicksPerStep: 1_000,
}));

process.stdout.write(`${JSON.stringify(profiler.run({
  environmentCounts: counts,
  episodesPerEnvironment: episodes,
  warmupEpisodes: warmups,
}), null, 2)}\n`);

function argument(name: string, fallback: string): string {
  const prefix = `--${name}=`;
  return process.argv.find(item => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

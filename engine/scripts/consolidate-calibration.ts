import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  calibrationDistribution,
  calibrationResultFromSamples,
  type MatchSample,
} from "../src/application/match/calibration";

const args = process.argv.slice(2);
const allowPartial = args.includes("--allow-partial");
const outputIndex = args.indexOf("--output");
if (outputIndex < 0 || !args[outputIndex + 1]) throw new Error("Usage: consolidate-calibration <shards...> --output <file> [--allow-partial]");
const output = args[outputIndex + 1];
const inputs = args.slice(0, outputIndex).filter(arg => arg !== "--allow-partial");
if (!inputs.length) throw new Error("At least one shard is required");

const documents = inputs.map(path => JSON.parse(readFileSync(resolve(path), "utf8")));
if (!allowPartial && documents.some(document => document.status !== "COMPLETE")) {
  throw new Error("All calibration shards must be COMPLETE (use --allow-partial only for persisted checkpoint samples)");
}
const ticks = new Set<number>(documents.map(document => Number(document.tick)));
if (ticks.size !== 1) throw new Error("Calibration shards use different timesteps");
const samples = documents.flatMap(document => document.samples) as MatchSample[];
const seeds = samples.map(sample => sample.seed);
if (new Set(seeds).size !== seeds.length) throw new Error("Calibration inputs contain duplicate seeds");
const result = calibrationResultFromSamples(samples, Math.min(...samples.map(sample => sample.seed)));
// Older persisted shards predate some operational fields. They remain
// readable, while new runs populate every member of the current ontology.
const sum = (key: keyof MatchSample): number => samples.reduce((total, sample) => total + Number(sample[key] ?? 0), 0);
const perMatch = (key: keyof MatchSample): number => sum(key) / samples.length;
const passes = sum("passes");
const operational = {
  passesAttemptedPerMatch: perMatch("passes"),
  passesCompletedPerMatch: perMatch("passesCompleted"),
  passAccuracyPercent: passes ? sum("passesCompleted") / passes * 100 : 0,
  tacklesPerMatch: perMatch("tackles"),
  tacklesWonPerMatch: perMatch("tacklesWon"),
  interceptionsPerMatch: perMatch("interceptions"),
  recoveriesPerMatch: perMatch("recoveries"),
  duelsPerMatch: perMatch("duels"),
  duelsWonPerMatch: perMatch("duelsWon"),
};
const document = {
  status: "COMPLETE", matches: samples.length,
  seedStart: Math.min(...samples.map(sample => sample.seed)),
  seedEnd: Math.max(...samples.map(sample => sample.seed)),
  tick: [...ticks][0], report: result.report, formatted: result.formatted,
  distribution: calibrationDistribution(result.samples), operational, samples: result.samples,
};
persist(output, document);
console.log(result.formatted);
console.log("\nOperational event-derived averages (both teams / match):");
for (const [key, value] of Object.entries(operational)) console.log(`  ${key}: ${value.toFixed(2)}`);

function persist(path: string, value: unknown): void {
  const destination = resolve(path);
  mkdirSync(dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(temporary, destination);
}

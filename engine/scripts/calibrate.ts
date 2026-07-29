/**
 * Phase 10 calibration CLI.
 *
 * Usage (with ts-node / tsx):
 *   npx tsx scripts/calibrate.ts --matches 100 --seed 1
 *
 * Or after build:
 *   node -r ts-node/register scripts/calibrate.ts
 */

import {
  CalibrationRunner,
  ENGINE_CALIBRATION_PARAMETERS,
  averageShotOutcomes,
  calibrationDistribution,
  suggestAdjustments,
} from "../src/application/match/calibration";
import { buildSimulationConfig } from "../tests/helpers/builders";

function parseArgs(argv: string[]): { matches: number; seed: number; tick: number } {
  let matches = 50;
  let seed = 1;
  let tick = ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--matches" && argv[i + 1]) matches = Number(argv[++i]);
    if (argv[i] === "--seed" && argv[i + 1]) seed = Number(argv[++i]);
    if (argv[i] === "--tick" && argv[i + 1]) tick = Number(argv[++i]);
  }

  return { matches, seed, tick };
}

function main(): void {
  const { matches, seed, tick } = parseArgs(process.argv.slice(2));
  const runner = new CalibrationRunner();

  console.log(`Running ${matches} matches (seed ${seed}+, tick ${tick}s)...`);

  const result = runner.run({
    matchCount: matches,
    seedStart: seed,
    tickDeltaSeconds: tick,
    buildConfig: (s) => buildSimulationConfig(s),
    onMatchComplete: (i, total) => {
      if (i % Math.max(1, Math.floor(total / 10)) === 0 || i === total) {
        console.log(`  ${i}/${total}`);
      }
    },
  });

  console.log("\n" + result.formatted);

  const outcomes = averageShotOutcomes(result.samples);
  const percentage = (value: number): string => outcomes.total > 0
    ? `${(value / outcomes.total * 100).toFixed(1)}%`
    : "0.0%";
  console.log("\nSpatial shot outcomes (average per match / share):");
  for (const [label, value] of [
    ["Blocked", outcomes.blocked],
    ["Off target", outcomes.offTarget],
    ["Woodwork", outcomes.woodwork],
    ["Saved (caught)", outcomes.savedCaught],
    ["Saved (parried)", outcomes.savedParried],
    ["Goals", outcomes.goals],
    ["Unresolved", outcomes.unresolved],
  ] as const) {
    console.log(`  ${label.padEnd(18)} ${value.toFixed(2).padStart(6)}  ${percentage(value).padStart(6)}`);
  }
  for (const sample of result.samples.filter(sample => sample.unresolvedShotIds.length > 0)) {
    console.log(`  Unresolved seed ${sample.seed}: ${sample.unresolvedShotIds.join(", ")}`);
  }

  const distribution = calibrationDistribution(result.samples);
  console.log("\nDistribution diagnostics:");
  console.log(`  Goals p10 / median / p90  ${distribution.goalsP10.toFixed(1)} / ${distribution.goalsMedian.toFixed(1)} / ${distribution.goalsP90.toFixed(1)}`);
  console.log(`  Zero-goal match rate       ${(distribution.zeroGoalMatchRate * 100).toFixed(1)}%`);
  console.log(`  Median shots / on target   ${distribution.shotsMedian.toFixed(1)} / ${distribution.shotsOnTargetMedian.toFixed(1)}`);

  const misses = result.report.comparisons.filter((c) => !c.withinTolerance);
  if (misses.length > 0) {
    console.log("\nSuggested adjustments:");
    for (const m of misses) {
      const tips = suggestAdjustments(m.key, m.observed, m.target);
      console.log(`  ${m.label}: ${tips.join("; ")}`);
    }
  } else {
    console.log("\nAll tracked metrics within tolerance.");
  }

  process.exitCode = result.report.converged ? 0 : 1;
}

main();

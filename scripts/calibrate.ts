/**
 * Phase 10 calibration CLI.
 *
 * Usage (with ts-node / tsx):
 *   npx tsx scripts/calibrate.ts --matches 100 --seed 1
 *
 * Or after build:
 *   node -r ts-node/register scripts/calibrate.ts
 */

import { CalibrationRunner } from "../src/application/match/calibration";
import { suggestAdjustments } from "../src/application/match/calibration";
import { buildSimulationConfig } from "../tests/helpers/builders";

function parseArgs(argv: string[]): { matches: number; seed: number; tick: number } {
  let matches = 50;
  let seed = 1;
  let tick = 2;

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

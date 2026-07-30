import { MatchEngine } from "../src/application/match/engine/MatchEngine";
import type { GoalContext, OffensiveFailureReason, TeamOffensiveFunnel } from "../src/application/match/diagnostics/OffensiveFunnelCollector";
import { ENGINE_CALIBRATION_PARAMETERS } from "../src/application/match/calibration";
import { buildSimulationConfig } from "../tests/helpers/builders";

const arg = (name: string, fallback: number): number => {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
};
const matches = arg("--matches", 20), seedStart = arg("--seed", 1);
const tick = arg("--tick", ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds);
const duration = arg("--duration", 90 * 60);
const engine = new MatchEngine();
const stages = ["possessions", "progressions", "finalThirdEntries", "penaltyAreaEntries", "receptionsInArea", "shots", "shotsOnTarget", "goals"] as const;
const totals = Object.fromEntries(stages.map(key => [key, 0])) as Record<typeof stages[number], number>;
const reasons: Record<string, number> = {}, contexts: Record<string, number> = {}, goalDistribution: Record<string, number> = {};
const sterileSeeds: number[] = [];

const addTeam = (team: TeamOffensiveFunnel): void => {
  for (const key of stages) totals[key] += team[key];
  for (const [key, value] of Object.entries(team.reasons)) reasons[key] = (reasons[key] ?? 0) + value;
  for (const [key, value] of Object.entries(team.goalContexts)) contexts[key] = (contexts[key] ?? 0) + value;
};
for (let index = 0; index < matches; index++) {
  const seed = seedStart + index;
  const result = engine.simulate({ ...buildSimulationConfig(seed), seed, tickDeltaSeconds: tick, maxDurationSeconds: duration });
  addTeam(result.offensiveFunnel.home); addTeam(result.offensiveFunnel.away);
  const goals = result.homeScore + result.awayScore;
  goalDistribution[String(goals)] = (goalDistribution[String(goals)] ?? 0) + 1;
  if (result.offensiveFunnel.home.shots === 0 || result.offensiveFunnel.away.shots === 0) sterileSeeds.push(seed);
  console.log(`${index + 1}/${matches} seed=${seed} score=${result.homeScore}-${result.awayScore} box=${result.offensiveFunnel.home.penaltyAreaEntries + result.offensiveFunnel.away.penaltyAreaEntries} shots=${result.homeShots + result.awayShots}`);
}
console.log("\nOffensive funnel (both teams)");
for (const key of stages) console.log(`${key.padEnd(22)} ${totals[key]} (${(totals[key] / matches).toFixed(2)}/match)`);
console.log("\nReasons", reasons as Record<OffensiveFailureReason, number>);
console.log("Goal contexts", contexts as Record<GoalContext, number>);
console.log("Goal distribution", goalDistribution);
console.log("Seeds with a team on zero shots", sterileSeeds);

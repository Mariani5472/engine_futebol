import { simulateMatch } from "../src/index.js";
import { makeTeam } from "./helpers.js";

const matches = 10_000;
let homeWins = 0;
let draws = 0;
let awayWins = 0;
let totalGoals = 0;
let homeShots = 0;
let awayShots = 0;
const home = makeTeam("home");
const away = makeTeam("away");

for (let seed = 1; seed <= matches; seed += 1) {
  const result = simulateMatch({ homeTeam: home, awayTeam: away, seed });
  if (result.score.home > result.score.away) homeWins += 1;
  else if (result.score.home < result.score.away) awayWins += 1;
  else draws += 1;
  totalGoals += result.score.home + result.score.away;
  homeShots += result.statistics.shots.home;
  awayShots += result.statistics.shots.away;
}

console.log(`Home wins: ${((homeWins / matches) * 100).toFixed(1)}%`);
console.log(`Draws: ${((draws / matches) * 100).toFixed(1)}%`);
console.log(`Away wins: ${((awayWins / matches) * 100).toFixed(1)}%`);
console.log(`Average goals: ${(totalGoals / matches).toFixed(2)}`);
console.log(`Average shots: Home ${(homeShots / matches).toFixed(2)}, Away ${(awayShots / matches).toFixed(2)}`);

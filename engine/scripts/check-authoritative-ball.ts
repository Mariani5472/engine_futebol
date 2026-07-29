import { MatchEngine } from "../src/application/match/engine/MatchEngine";
import { ENGINE_CALIBRATION_PARAMETERS } from "../src/application/match/calibration";
import { buildSimulationConfig } from "../tests/helpers/builders";

function numberArg(name: string, fallback: number): number {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? Number(process.argv[index + 1]) : fallback;
}

const matches = numberArg("--matches", 20);
const seedStart = numberArg("--seed", 1);
const tick = numberArg("--tick", ENGINE_CALIBRATION_PARAMETERS.officialTickSeconds);
const engine = new MatchEngine();
let acquisitions = 0;
let passResolutions = 0;
let highSpeedControls = 0;
let worstTenSecondBurst = 0;

for (let index = 0; index < matches; index++) {
  const seed = seedStart + index;
  const result = engine.simulate({
    ...buildSimulationConfig(seed),
    seed,
    tickDeltaSeconds: tick,
    maxDurationSeconds: 90 * 60,
  });
  const teleports = result.diagnostics.filter(event => event.type === "BALL_TELEPORT");
  const claims = result.diagnostics.filter(event => event.type === "POSSESSION_CHANGED");
  const invalidClaim = claims.find(event => event.distanceToBall > 1.5 + 1e-6);
  if (teleports.length || invalidClaim) {
    const failure = teleports[0] ?? invalidClaim;
    throw new Error(`Authoritative-ball violation seed=${seed}: ${JSON.stringify(failure)}`);
  }
  acquisitions += claims.length;
  highSpeedControls += claims.filter(event => event.ballSpeed >= 15 && event.reason !== "RESTART").length;
  for (let start = 0, end = 0; end < claims.length; end++) {
    while (claims[end].matchSecond - claims[start].matchSecond > 10) start++;
    worstTenSecondBurst = Math.max(worstTenSecondBurst, end - start + 1);
  }
  passResolutions += result.diagnostics.filter(event => event.type === "PASS_RESOLVED").length;
  console.log(`${index + 1}/${matches} seed=${seed} acquisitions=${claims.length} highSpeedControls=${claims.filter(event => event.ballSpeed >= 15 && event.reason !== "RESTART").length} teleports=0`);
}

console.log(`OK: ${matches} matches, ${acquisitions} physical acquisitions, ${passResolutions} passes resolved, ${highSpeedControls} controls above 15m/s, max 10s burst=${worstTenSecondBurst}, zero teleports.`);

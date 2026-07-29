import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";
import { buildSimulationConfig } from "../helpers/builders";

function fastConfig(seed: number): SimulationConfig {
  return {
    ...buildSimulationConfig(seed),
    seed,
    tickDeltaSeconds: .05,
    maxDurationSeconds: 90,
  };
}

describe("Match Engine — determinism across seeds", () => {
  it("produces bit-identical summaries for the same seed", () => {
    const engine = new MatchEngine();
    const first = engine.simulate(fastConfig(1));
    const second = engine.simulate(fastConfig(1));

    expect({
      homeScore: first.homeScore,
      awayScore: first.awayScore,
      homeShots: first.homeShots,
      awayShots: first.awayShots,
      events: first.events,
      metrics: first.metrics,
    }).toEqual({
      homeScore: second.homeScore,
      awayScore: second.awayScore,
      homeShots: second.homeShots,
      awayShots: second.awayShots,
      events: second.events,
      metrics: second.metrics,
    });
  });

  it("allows different seeds to produce different event streams", () => {
    const engine = new MatchEngine();
    const streams = [1, 2, 3].map((seed) =>
      JSON.stringify(engine.simulate(fastConfig(seed)).events),
    );

    expect(new Set(streams).size).toBeGreaterThan(1);
  });
});

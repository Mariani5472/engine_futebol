import { MatchEngine } from "../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../helpers/builders";
import { SimulationConfig } from "../../src/application/match/engine/SimulationConfig";

function fastConfig(seed: number): SimulationConfig {
  return { ...buildSimulationConfig(seed), tickDeltaSeconds: 10 };
}

describe("Match Engine — Determinism across seeds", () => {
  const engine = new MatchEngine();

  const seeds = [1, 42, 100, 9999, 777777];

  for (const seed of seeds) {
    it(`seed ${seed}: two runs are bit-identical`, () => {
      const r1 = engine.simulate(fastConfig(seed));
      const r2 = engine.simulate(fastConfig(seed));

      expect(r1.homeScore).toBe(r2.homeScore);
      expect(r1.awayScore).toBe(r2.awayScore);
      expect(r1.homeShots).toBe(r2.homeShots);
      expect(r1.awayShots).toBe(r2.awayShots);
      expect(r1.events.length).toBe(r2.events.length);
    });
  }

  it("different seeds produce at least some variation in scores across 10 runs", () => {
    const scores = Array.from({ length: 10 }, (_, i) => {
      const r = engine.simulate(fastConfig(i + 1));
      console.log(`${r.homeScore}-${r.awayScore}`)
      return `${r.homeScore}-${r.awayScore}`;
    });
    const unique = new Set(scores);
    // With 10 different seeds we expect at least two distinct scorelines.
    expect(unique.size).toBeGreaterThanOrEqual(2);
  });

});

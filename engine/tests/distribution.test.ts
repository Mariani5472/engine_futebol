import { simulateMatch } from "../src/index.js";
import { makeTeam } from "./helpers.js";

describe("match distribution", () => {
  it("creates goals, scoreless matches, and a probabilistic advantage for better teams", () => {
    let goals = 0;
    let scoreless = 0;
    let strongerWins = 0;
    const strong = makeTeam("strong", 17);
    const weak = makeTeam("weak", 9);
    for (let seed = 1; seed <= 500; seed += 1) {
      const result = simulateMatch({ homeTeam: strong, awayTeam: weak, seed });
      goals += result.score.home + result.score.away;
      if (result.score.home + result.score.away === 0) scoreless += 1;
      if (result.score.home > result.score.away) strongerWins += 1;
    }
    expect(goals).toBeGreaterThan(0);
    expect(scoreless).toBeGreaterThan(0);
    expect(strongerWins).toBeGreaterThan(250);
    expect(strongerWins).toBeLessThan(500);
  });
});

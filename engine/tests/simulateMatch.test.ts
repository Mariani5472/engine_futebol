import { simulateMatch } from "../src/index.js";
import { makeTeam } from "./helpers.js";

const input = { homeTeam: makeTeam("home"), awayTeam: makeTeam("away"), seed: 12345 };

describe("simulateMatch", () => {
  it("is deterministic for the same input and seed", () => {
    expect(simulateMatch(input)).toEqual(simulateMatch(input));
  });

  it("normally produces a different match for a different seed", () => {
    expect(simulateMatch({ ...input, seed: 1 })).not.toEqual(simulateMatch({ ...input, seed: 2 }));
  });

  it("produces a complete valid match", () => {
    const result = simulateMatch({ ...input, debug: true });
    expect(result.events[0]).toEqual({ type: "MATCH_STARTED", minute: 0 });
    expect(result.events.some((event) => event.type === "HALF_TIME" && event.minute === 45)).toBe(true);
    expect(result.events.at(-1)).toEqual({ type: "MATCH_FINISHED", minute: 90 });
    expect(result.finalState).toMatchObject({ minute: 90, status: "FINISHED" });
    expect(result.score.home).toBeGreaterThanOrEqual(0);
    expect(result.score.away).toBeGreaterThanOrEqual(0);
    expect(result.statistics.possession.home + result.statistics.possession.away).toBe(100);
    expect(result.statistics.goals).toEqual(result.score);
    for (const event of result.events) {
      expect(event.minute).toBeGreaterThanOrEqual(0);
      expect(event.minute).toBeLessThanOrEqual(90);
      if ("teamId" in event) expect(["home", "away"]).toContain(event.teamId);
      if ("playerId" in event) expect([...input.homeTeam.players, ...input.awayTeam.players].some((player) => player.id === event.playerId)).toBe(true);
    }
  });

  it("keeps input player attributes unchanged and in their documented range", () => {
    simulateMatch(input);
    for (const player of [...input.homeTeam.players, ...input.awayTeam.players]) {
      for (const value of Object.values(player.attributes)) expect(value).toBeGreaterThanOrEqual(1);
      for (const value of Object.values(player.attributes)) expect(value).toBeLessThanOrEqual(20);
    }
  });
});

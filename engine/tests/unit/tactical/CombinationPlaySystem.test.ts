import { CombinationPlaySystem } from "../../../src/application/match/tactical/intelligence/CombinationPlaySystem";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("CombinationPlaySystem", () => {
  it("recognizes a third-man route without guaranteeing the sequence", () => {
    const state = buildMinimalMatchState();
    const a = state.home.players[0];
    const b = state.home.players[1];
    const c = state.home.players[0];
    // The minimal fixture has two home players; add the same physical player
    // under a distinct tactical id through a lane-only third option.
    const thirdId = "third-runner";
    const combinations = new CombinationPlaySystem().detect(state, state.home, [
      { fromPlayerId:a.player.id, toPlayerId:b.player.id, target:b.position, arrivalMargin:.5, progression:6, clearAtArrival:true },
      { fromPlayerId:b.player.id, toPlayerId:thirdId, target:new Vector2(94,34), arrivalMargin:.35, progression:12, clearAtArrival:true },
    ]);
    const thirdMan = combinations.find(item => item.type === "thirdMan");
    expect(thirdMan?.thirdPlayerId).toBe(thirdId);
    expect(thirdMan?.completionProbability).toBeGreaterThan(.3);
    expect(thirdMan?.expiresAt).toBeGreaterThan(state.currentSecond);
    void c;
  });

  it("marks a one-two unavailable when the return lane will close", () => {
    const state = buildMinimalMatchState();
    const a = state.home.players[0];
    const b = state.home.players[1];
    a.oneTwoPartnerId = b.player.id;
    a.oneTwoAvailableUntil = 3;
    const combinations = new CombinationPlaySystem().detect(state, state.home, [
      { fromPlayerId:b.player.id, toPlayerId:a.player.id, target:a.position, arrivalMargin:-.4, progression:5, clearAtArrival:false },
    ]);
    expect(combinations.find(item => item.type === "oneTwo")?.availableReturnLane).toBe(false);
  });
});

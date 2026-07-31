import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallPlacement } from "../../../src/core/movement/BallPlacement";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("BallPlacement", () => {
  it("atomically establishes the owner invariants for a restart", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[0];
    const position = new Vector2(52.5, 34);
    BallPlacement.forSetPiece(state.ball, player, position, 12);
    expect(state.ball.owner).toBe(player);
    expect(player.hasBall).toBe(true);
    expect(state.ball.state).toBe(BallState.CONTROLLED);
    expect(state.ball.position).toEqual(position);
    expect(state.ball.visualPosition).toEqual(position);
    expect(state.ball.motion).toBeNull();
    expect(state.ball.activeShot).toBeNull();
  });

  it("clears causal residue when initializing an isolated scenario", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[0];
    state.ball.lastCompletedPass = {
      passerId: "old", receiverId: "old-receiver", completedAtSecond: 1, interventions: [],
    };
    state.ball.restrictedTouchPlayerId = "old";
    BallPlacement.forScenario(state.ball, player, new Vector2(70, 30));
    expect(state.ball.owner).toBe(player);
    expect(state.ball.lastCompletedPass).toBeNull();
    expect(state.ball.restrictedTouchPlayerId).toBeNull();
    expect(state.ball.lastTouchedPlayerId).toBe(player.player.id);
  });
});

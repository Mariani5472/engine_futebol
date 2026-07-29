import { PlayerIntentSystem } from "../../../src/application/match/tactical/intelligence/PlayerIntentSystem";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("PlayerIntentSystem", () => {
  it("does not cancel a committed run merely because a new tick happened", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[1];
    const system = new PlayerIntentSystem();
    system.commit(state, player, { type:"attackSpace", targetPosition:new Vector2(88, 40), expiresAt:3,
      confidence:.8, commitment:.85, cancelConditions:["possessionChanged", "expired"], reason:"continue post-pass run" });
    state.currentSecond = .8;
    system.update(state);
    system.enforce(state);
    expect(player.intent?.type).toBe("attackSpace");
    expect(player.targetPosition.x).toBe(88);
  });

  it("cancels an offensive run when physical possession changes team", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[1];
    const system = new PlayerIntentSystem();
    system.commit(state, player, { type:"attackSpace", targetPosition:new Vector2(88, 40), expiresAt:3,
      confidence:.8, commitment:.85, cancelConditions:["possessionChanged", "expired"], reason:"continue post-pass run" });
    const opponent = state.away.players[0];
    state.ball.acquirePossession(opponent, "TEST", .4);
    state.currentSecond = .4;
    system.update(state);
    expect(player.intent).toBeNull();
  });
});

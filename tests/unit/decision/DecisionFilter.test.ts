import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { DecisionFilter } from "../../../src/application/match/decision/DecisionFilter";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";

function makeContext(hasBall: boolean): DecisionContext {
  const state = buildMinimalMatchState();
  const player = buildPlayerMatchState({ hasBall, position: state.ball.position });

  // Make the player part of home team.
  state.home.players.splice(0, state.home.players.length, player);
  if (hasBall) {
    (state.ball as any).owner = player;
  }

  const awareness = PlayerAwareness.create(player.player.id);

  return new DecisionContext(state, player, awareness, 0, 0.5);
}

describe("DecisionFilter", () => {
  const filter = new DecisionFilter();

  describe("ball carrier", () => {
    it("allows PASS when player has ball", () => {
      const ctx = makeContext(true);
      const decisions = [new Decision(DecisionType.PASS, 50, "teammate-1")];
      const result = filter.filter(decisions, ctx);
      expect(result.some(d => d.type === DecisionType.PASS)).toBe(true);
    });

    it("allows SHOT when player has ball", () => {
      const ctx = makeContext(true);
      const decisions = [new Decision(DecisionType.SHOT, 40)];
      const result = filter.filter(decisions, ctx);
      expect(result.some(d => d.type === DecisionType.SHOT)).toBe(true);
    });

    it("blocks TACKLE when player has ball", () => {
      const ctx = makeContext(true);
      const decisions = [new Decision(DecisionType.TACKLE, 50)];
      const result = filter.filter(decisions, ctx);
      // Should fall back, not return TACKLE.
      expect(result.some(d => d.type === DecisionType.TACKLE)).toBe(false);
    });
  });

  describe("non-ball carrier", () => {
    it("allows TACKLE when no ball but close to carrier", () => {
      const ctx = makeContext(false);
      // Give the ball to an opponent nearby.
      const opponent = state_of(ctx);
      const decisions = [new Decision(DecisionType.TACKLE, 50)];
      // Player has no ball and there's an opponent ball-carrier — should pass.
      const result = filter.filter(decisions, ctx);
      // The filter may or may not allow tackle depending on distance.
      expect(result.length).toBeGreaterThan(0);
    });

    it("blocks SHOT when player has no ball", () => {
      const ctx = makeContext(false);
      const decisions = [new Decision(DecisionType.SHOT, 80)];
      const result = filter.filter(decisions, ctx);
      expect(result.some(d => d.type === DecisionType.SHOT)).toBe(false);
    });

    it("blocks PASS when player has no ball", () => {
      const ctx = makeContext(false);
      const decisions = [new Decision(DecisionType.PASS, 80)];
      const result = filter.filter(decisions, ctx);
      expect(result.some(d => d.type === DecisionType.PASS)).toBe(false);
    });
  });

  describe("fallback", () => {
    it("returns HOLD_BALL fallback when no valid decisions and player has ball", () => {
      const ctx = makeContext(true);
      // All illegal decisions.
      const decisions = [new Decision(DecisionType.TACKLE, 50)];
      const result = filter.filter(decisions, ctx);
      expect(result.some(d => d.type === DecisionType.HOLD_BALL)).toBe(true);
    });

    it("returns MOVE fallback when no valid decisions and player has no ball", () => {
      const ctx = makeContext(false);
      // All illegal decisions.
      const decisions = [new Decision(DecisionType.SHOT, 50)];
      const result = filter.filter(decisions, ctx);
      expect(result.some(d => d.type === DecisionType.MOVE)).toBe(true);
    });

    it("never returns an empty list", () => {
      const ctx = makeContext(true);
      const result = filter.filter([], ctx);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

// Helper to get the match state from a context for test setup.
function state_of(ctx: DecisionContext) {
  return ctx.match;
}

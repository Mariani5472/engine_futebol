import { OffensiveFunnelCollector } from "../../../src/application/match/diagnostics/OffensiveFunnelCollector";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("OffensiveFunnelCollector", () => {
  it("counts each possession milestone once and records its physical outcome", () => {
    const state = buildMinimalMatchState();
    const collector = new OffensiveFunnelCollector();
    const owner = state.home.players[0];
    owner.hasBall = true;
    state.ball.owner = owner;
    state.ball.position = new Vector2(10, 34);
    collector.sample(state);
    state.ball.position = new Vector2(25, 34);
    collector.sample(state);
    collector.sample(state);
    state.ball.position = new Vector2(75, 34);
    collector.sample(state);
    state.ball.position = new Vector2(94, 34);
    owner.position = state.ball.position;
    collector.sample(state);
    collector.onAcquisitions([{
      type: "POSSESSION_CHANGED", matchSecond: 10, playerId: owner.player.id,
      distanceToBall: 0, ballSpeed: 0, reason: "INTENDED_RECEPTION", previousAction: null,
      ballPosition: owner.position, playerPosition: owner.position,
    }], state);
    collector.onEvents([{ type: "SHOT", id: "shot-1", timestamp: 10_000 as never,
      period: "FIRST_HALF", teamId: state.home.team.id as never, playerId: owner.player.id as never,
      result: "SAVED", targetX: 105, targetY: 34 }], state);

    const home = collector.snapshot().home;
    expect(home).toMatchObject({ possessions: 1, progressions: 1, finalThirdEntries: 1,
      penaltyAreaEntries: 1, receptionsInArea: 1, shots: 1, shotsOnTarget: 1 });
    expect(home.reasons.SHOT_SAVED).toBe(1);
  });

  it("classifies failed passes, sterile losses and goal contexts", () => {
    const state = buildMinimalMatchState();
    const collector = new OffensiveFunnelCollector();
    const owner = state.home.players[0];
    owner.position = new Vector2(20, 34);
    owner.hasBall = true; state.ball.owner = owner; state.ball.position = owner.position;
    collector.sample(state);
    collector.onPassResolution({ type: "PASS_RESOLVED", matchSecond: 2, passerId: owner.player.id,
      intendedReceiverId: state.home.players[1].player.id, controllingPlayerId: state.away.players[0].player.id,
      success: false, realForwardGain: 8 }, state);
    owner.hasBall = false; state.away.players[0].hasBall = true; state.ball.owner = state.away.players[0];
    collector.sample(state);
    const home = collector.snapshot().home;
    expect(home.reasons.PASS_BLOCKED).toBe(1);
    expect(home.reasons.BALL_LOST).toBe(1);
    expect(home.sterilePossessions).toBe(1);
  });

  it("keeps unsupported offside diagnostics explicitly at zero", () => {
    expect(new OffensiveFunnelCollector().snapshot().home.reasons.OFFSIDE).toBe(0);
  });
});

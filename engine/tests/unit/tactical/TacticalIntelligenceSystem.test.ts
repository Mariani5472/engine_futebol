import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { PossessionPredictionSystem } from "../../../src/application/match/tactical/PossessionPredictionSystem";
import { TacticalIntelligenceSystem } from "../../../src/application/match/tactical/intelligence/TacticalIntelligenceSystem";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildSimulationConfig } from "../../helpers/builders";

describe("TacticalIntelligenceSystem", () => {
  const initialize = () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(71)).state;
    state.kickoff = null;
    return state;
  };

  it("keeps a safe same-team pass in offensiveBallFlight", () => {
    const state = initialize();
    const prediction = new PossessionPredictionSystem();
    const intelligence = new TacticalIntelligenceSystem();
    const passer = state.home.players[6];
    const receiver = state.home.players[9];
    passer.position = new Vector2(48, 34);
    receiver.position = new Vector2(61, 34);
    state.ball.acquirePossession(passer, "TEST", 0);
    prediction.update(state);
    intelligence.update(state);

    state.home.players.forEach(player => player.hasBall = false);
    state.ball.startMotion({ kind:"GROUND_PASS", origin:passer.position, target:receiver.position,
      duration:1, peakHeight:0, curve:0, hasExplicitEffect:false, intendedReceiverId:receiver.player.id,
      startHeight:0, targetHeight:0 });
    state.ball.pendingPass = { passerId:passer.player.id, intendedReceiverId:receiver.player.id, startedAtSecond:1, realForwardGain:13 };
    state.away.players.forEach((player,index) => player.position = new Vector2(82, 4 + index * 5));
    state.currentSecond = 1;
    prediction.update(state);
    intelligence.update(state);
    state.currentSecond = 1.3;
    prediction.update(state);
    const snapshot = intelligence.update(state);

    expect(snapshot.teams.get(state.home.team.id)?.currentPhase).toBe("offensiveBallFlight");
    expect(snapshot.teams.get(state.away.team.id)?.currentPhase).not.toBe("establishedAttack");
  });

  it("uses physical arrival evidence to enter defensiveTransition", () => {
    const state = initialize();
    const prediction = new PossessionPredictionSystem();
    const intelligence = new TacticalIntelligenceSystem();
    const passer = state.home.players[6];
    const receiver = state.home.players[9];
    const interceptor = state.away.players[6];
    const target = new Vector2(60, 34);
    state.ball.acquirePossession(passer, "TEST", 0);
    prediction.update(state);
    intelligence.update(state);
    receiver.position = new Vector2(38, 34);
    interceptor.position = target;
    state.ball.startMotion({ kind:"GROUND_PASS", origin:passer.position, target,
      duration:1, peakHeight:0, curve:0, hasExplicitEffect:false, intendedReceiverId:receiver.player.id,
      startHeight:0, targetHeight:0 });
    state.currentSecond = 1;
    prediction.update(state);
    intelligence.update(state);
    state.currentSecond = 1.3;
    prediction.update(state);
    const snapshot = intelligence.update(state);
    expect(snapshot.teams.get(state.home.team.id)?.currentPhase).toBe("defensiveTransition");
  });

  it("publishes trajectories, future spaces, patterns and collective reservations", () => {
    const state = initialize();
    const player = state.home.players[8];
    player.velocity = new Vector2(4, -1);
    player.intent = { type:"attackSpace", targetPosition:new Vector2(72, 12), startedAt:0, expiresAt:3,
      confidence:.8, commitment:.9, possessionTeamId:state.home.team.id,
      cancelConditions:["expired"], reason:"test forward run" };
    const intelligence = new TacticalIntelligenceSystem();
    intelligence.update(state);
    state.currentSecond = .2;
    const snapshot = intelligence.update(state);
    const spatial = snapshot.players.get(player.player.id)!;
    const team = snapshot.teams.get(state.home.team.id)!;
    expect(spatial.predictedTrajectory["1"].x).toBeGreaterThan(spatial.position.x);
    expect(spatial.recentTrajectory.length).toBeGreaterThan(1);
    expect(team.spaces.length).toBeGreaterThan(10);
    expect(team.runningLanes.length).toBeGreaterThan(0);
    expect(team.reservations.some(item => item.playerId === player.player.id)).toBe(true);
  });

  it("applies phase hysteresis to a one-frame contested prediction", () => {
    const state = initialize();
    const intelligence = new TacticalIntelligenceSystem();
    const owner = state.home.players[6];
    state.ball.acquirePossession(owner, "TEST", 0);
    state.home.possessionState = "controlledPossession";
    state.home.possessionPrediction = { likelyTeamId:state.home.team.id, likelyReceiverId:owner.player.id,
      confidence:1, interceptionRisk:0, state:"controlled", estimatedArrivalTimes:{[owner.player.id]:0}, transitionReason:"TEST" };
    intelligence.update(state);
    state.ball.release();
    state.home.possessionPrediction = { confidence:.5, interceptionRisk:.5, state:"contested", estimatedArrivalTimes:{}, transitionReason:"TEST" };
    state.currentSecond = .1;
    const transient = intelligence.update(state);
    expect(transient.teams.get(state.home.team.id)?.currentPhase).toBe("establishedAttack");
  });
});


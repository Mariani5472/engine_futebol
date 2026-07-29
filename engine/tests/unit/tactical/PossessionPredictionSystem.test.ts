import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { PossessionPredictionSystem } from "../../../src/application/match/tactical/PossessionPredictionSystem";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildSimulationConfig } from "../../helpers/builders";

describe("PossessionPredictionSystem", () => {
  const initialize = () => new MatchInitializer().initialize(buildSimulationConfig(31)).state;

  it("keeps probable team possession during a safe pass", () => {
    const state=initialize();
    const system=new PossessionPredictionSystem();
    const passer=state.home.players[5];
    const receiver=state.home.players[8];
    receiver.position=new Vector2(55,34);
    state.away.players.forEach((player,index)=>player.position=new Vector2(82,index*5+4));
    system.update(state);
    state.currentSecond=5;
    state.ball.startMotion({kind:"GROUND_PASS",origin:passer.position,target:receiver.position,duration:1,peakHeight:0,curve:0,hasExplicitEffect:false,intendedReceiverId:receiver.player.id,startHeight:0,targetHeight:0});
    state.ball.pendingPass={passerId:passer.player.id,intendedReceiverId:receiver.player.id,startedAtSecond:5,realForwardGain:12};
    system.update(state);
    state.currentSecond=5.2;
    system.update(state);

    expect(state.home.possessionState).toBe("probablePossession");
    expect(state.home.possessionPrediction.likelyTeamId).toBe(state.home.team.id);
    expect(state.home.possessionPrediction.confidence).toBeGreaterThan(.65);
  });

  it("predicts transition when an opponent arrives clearly first", () => {
    const state=initialize();
    const system=new PossessionPredictionSystem();
    const passer=state.home.players[5];
    const receiver=state.home.players[8];
    const target=new Vector2(58,34);
    receiver.position=new Vector2(38,34);
    state.away.players[4].position=target;
    system.update(state);
    state.currentSecond=7;
    state.ball.startMotion({kind:"GROUND_PASS",origin:passer.position,target,duration:1,peakHeight:0,curve:0,hasExplicitEffect:false,intendedReceiverId:receiver.player.id,startHeight:0,targetHeight:0});
    system.update(state);
    state.currentSecond=7.2;
    system.update(state);

    expect(state.home.possessionState).toBe("transitionToDefense");
    expect(state.away.possessionState).toBe("transitionToAttack");
    expect(state.home.possessionPrediction.transitionReason).toBe("OPPONENT_ARRIVES_FIRST");
  });

  it("uses a contested state for overlapping arrival times", () => {
    const state=initialize();
    const system=new PossessionPredictionSystem();
    const passer=state.home.players[5];
    const receiver=state.home.players[8];
    const defender=state.away.players[4];
    const target=new Vector2(58,34);
    receiver.position=new Vector2(54,34);
    defender.position=new Vector2(54,34);
    state.ball.startMotion({kind:"GROUND_PASS",origin:passer.position,target,duration:1,peakHeight:0,curve:0,hasExplicitEffect:false,intendedReceiverId:receiver.player.id,startHeight:0,targetHeight:0});
    system.update(state);
    state.currentSecond=.2;
    system.update(state);
    expect(state.home.possessionState).toBe("contestedPossession");
    expect(state.home.possessionPrediction.state).toBe("contested");
  });
});

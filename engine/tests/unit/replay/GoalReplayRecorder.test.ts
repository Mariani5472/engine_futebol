import { GoalReplayRecorder } from "../../../src/application/match/replay/GoalReplayRecorder";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { buildSimulationConfig } from "../../helpers/builders";

describe("GoalReplayRecorder", () => {
  it("stores pre/post goal frames and never reruns the simulation", () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(5)).state;
    const recorder = new GoalReplayRecorder(.1, .1, .05);
    recorder.sample(state, []);
    state.currentSecond = .05;
    state.ball.position = state.ball.position.add({ x: 1, y: 0 } as any);
    recorder.sample(state, [{ id:"goal-1",type:"GOAL",timestamp:50 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,scorerId:state.home.players[9].player.id as any,assistId:null }]);
    state.currentSecond = .1;
    recorder.sample(state, []);
    state.currentSecond = .15;
    recorder.sample(state, []);
    const replay = recorder.replays()[0];
    expect(replay.goalEventId).toBe("goal-1");
    expect(replay.speed).toBe(1);
    expect(replay.frames.length).toBeGreaterThanOrEqual(3);
    expect(replay.frames.some(frame => frame.events.includes("goal-1"))).toBe(true);
    expect(replay.frames[0].camera.zoom).toBeGreaterThan(1);
    expect(replay.frames[0].players[0].bodyState).toBeDefined();
    expect(replay.frames[0].ball.velocityX).toBeDefined();
  });
});

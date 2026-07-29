import { MatchEventStore } from "../../../src/application/match/analytics/MatchEventStore";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import type { MatchEvent } from "../../../src/domain";
import { buildSimulationConfig } from "../../helpers/builders";

describe("MatchEventStore", () => {
  it("derives team/player pass and shot reports from normalized events", () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(4)).state;
    const store = new MatchEventStore("match-analytics");
    const events: MatchEvent[] = [
      { id:"pass-1",type:"PASS_ATTEMPTED",timestamp:1000 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,playerId:state.home.players[1].player.id as any,receiverId:state.home.players[2].player.id as any,originX:20,originY:20,targetX:40,targetY:25,passKind:"PASS" },
      { id:"pass-1-ok",type:"PASS_COMPLETED",timestamp:1500 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,playerId:state.home.players[1].player.id as any,receiverId:state.home.players[2].player.id as any,controllingPlayerId:state.home.players[2].player.id as any,forwardGain:20 },
      { id:"shot-1",type:"SHOT",timestamp:2000 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,playerId:state.home.players[9].player.id as any,result:"IN_FLIGHT",targetX:105,targetY:34 },
      { id:"shot-1-on",type:"SHOT_ON_TARGET",timestamp:2300 as any,period:"FIRST_HALF",shotId:"shot-1",teamId:state.home.team.id as any,playerId:state.home.players[9].player.id as any,positionX:105,positionY:34,height:1,outcome:"GOAL" },
      { id:"goal-1",type:"GOAL",timestamp:2300 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,scorerId:state.home.players[9].player.id as any,assistId:null },
    ];
    store.append(events);
    state.currentSecond = 3;
    store.sample(state);
    state.currentSecond = 4;
    store.sample(state);
    const report = store.finalize(state);
    expect(report.teams[state.home.team.id].passesAttempted).toBe(1);
    expect(report.teams[state.home.team.id].passesCompleted).toBe(1);
    expect(report.teams[state.home.team.id].shots).toBe(1);
    expect(report.teams[state.home.team.id].goals).toBe(1);
    expect(report.players[state.home.players[1].player.id].passesCompleted).toBe(1);
    expect(report.players[state.home.players[9].player.id].goals).toBe(1);
    expect(store.events()[0].matchId).toBe("match-analytics");
  });

  it("creates timeline entries only from real important events", () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(4)).state;
    const store = new MatchEventStore("timeline");
    store.append([
      { id:"goal",type:"GOAL",timestamp:67000 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,scorerId:state.home.players[9].player.id as any,assistId:null },
    ]);
    const timeline = store.timeline(new Set(["goal"]));
    expect(timeline).toHaveLength(1);
    expect(timeline[0].label).toContain(state.home.players[9].player.id);
    expect(timeline[0].replayAvailable).toBe(true);
    expect(timeline[0].secondaryPlayerId).toBeUndefined();
  });

  it("shows a causal assist carried by the goal event",()=>{
    const state=new MatchInitializer().initialize(buildSimulationConfig(4)).state;
    const scorer=state.home.players[9].player.id;
    const assistant=state.home.players[7].player.id;
    const store=new MatchEventStore("timeline-assist");
    store.append([{id:"goal-assisted",type:"GOAL",timestamp:67000 as any,period:"FIRST_HALF",teamId:state.home.team.id as any,scorerId:scorer as any,assistId:assistant as any}]);
    const entry=store.timeline(new Set(["goal-assisted"]))[0];
    expect(entry.secondaryPlayerId).toBe(assistant);
    expect(entry.label).toContain(`assistência: ${assistant}`);
  });
});

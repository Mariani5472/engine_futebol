import { Vector2 } from "../../../src/core/geometry/Vector2";
import { Vector3 } from "../../../src/core/geometry/Vector3";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { GoalkeeperSystem } from "../../../src/application/match/goalkeeper/GoalkeeperSystem";
import { createGoalFrame, type ShotExecution } from "../../../src/domain";
import { buildSimulationConfig } from "../../helpers/builders";

describe("GoalkeeperSystem", () => {
  const initialize = () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(21)).state;
    state.kickoff = null;
    return state;
  };

  it("tracks the ball laterally while staying between it and the protected goal", () => {
    const state = initialize();
    const goalkeeper = state.home.players.find(player => player.currentRole.includes("GOALKEEPER"))!;
    state.ball.position = new Vector2(28, 50);
    new GoalkeeperSystem().update(state);
    expect(goalkeeper.targetPosition.y).toBeGreaterThan(state.pitch.width / 2);
    expect(goalkeeper.targetPosition.x).toBeGreaterThan(0);
    expect(goalkeeper.targetPosition.x).toBeLessThanOrEqual(4);
  });

  it("closes down a nearby one-on-one when rushing ability supports it", () => {
    const state = initialize();
    const goalkeeper = state.home.players.find(player => player.currentRole.includes("GOALKEEPER"))!;
    const attacker = state.away.players.find(player => player.currentRole === "STRIKER")!;
    attacker.position = new Vector2(10, 34);
    attacker.hasBall = true;
    state.ball.owner = attacker;
    state.ball.position = attacker.position;
    goalkeeper.position = new Vector2(8.5, 34);
    new GoalkeeperSystem().update(state);
    if (goalkeeper.player.attributes.goalkeeping.rushingOut / 20 >= .58) {
      expect(["RUSHING_OUT","SMOTHERING"]).toContain(goalkeeper.goalkeeperState);
      expect(goalkeeper.targetPosition).toEqual(attacker.position);
    } else {
      expect(goalkeeper.goalkeeperState).not.toBe("RUSHING_OUT");
    }
  });

  it("sets an explicit reaction delay and interception target for a shot", () => {
    const state = initialize();
    const goalkeeper = state.away.players.find(player => player.currentRole.includes("GOALKEEPER"))!;
    const shooter = state.home.players.find(player => player.currentRole === "STRIKER")!;
    const target = new Vector3(105, 31, 1.2);
    const shot: ShotExecution = {
      id: "gk-shot", shooterId: shooter.player.id, teamId: state.home.team.id,
      defendingTeamId: state.away.team.id, goalkeeperId: goalkeeper.player.id,
      goalkeeperInitialPosition:goalkeeper.position,
      origin: new Vector3(95, 34, .18), intendedTarget: target, actualTarget: target,
      initialVelocity: new Vector3(30, 0, 0), speed: 30, shotType: "PLACED", footUsed: "RIGHT",
      expectedArrivalTime: .4, executionQuality: .8, pressureLevel: 0,
      bodyPosture: "BALANCED", balance: 1, contactQuality: .8, curve: 0, startedAt: 0,
      goalFrame: createGoalFrame(105, 34, 7.32, 2.44), lifecycle: "IN_FLIGHT",
      outcome: null, deflectionCount: 0, lastInteractionPlayerId: null,
      goalkeeperDecision:null,goalkeeperReactionTime:null,
    };
    state.ball.activeShot = shot;
    new GoalkeeperSystem().update(state);
    expect(goalkeeper.goalkeeperState).toBe("SET");
    expect(goalkeeper.goalkeeperReactionUntil).toBeGreaterThan(state.currentSecond);
    expect(goalkeeper.goalkeeperInterceptionTarget?.y).toBeCloseTo(31);

    state.currentSecond = goalkeeper.goalkeeperReactionUntil;
    new GoalkeeperSystem().update(state);
    expect(["DIVING", "CATCHING"]).toContain(goalkeeper.goalkeeperState);
    expect(shot.goalkeeperDecision).toBe(goalkeeper.goalkeeperState);
    expect(shot.goalkeeperReactionTime).toBeGreaterThan(0);
  });

  it("uses a timed recovery state after committing to a save",()=>{
    const state=initialize();
    const goalkeeper=state.home.players.find(player=>player.currentRole.includes("GOALKEEPER"))!;
    goalkeeper.goalkeeperState="PARRYING";goalkeeper.goalkeeperStateUntil=1;state.currentSecond=.5;
    new GoalkeeperSystem().update(state);
    expect(goalkeeper.goalkeeperState).toBe("RECOVERING");
    state.currentSecond=1.1;new GoalkeeperSystem().update(state);
    expect(goalkeeper.goalkeeperState).toBe("POSITIONING");
  });
});

import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { CollectivePhaseSystem } from "../../../src/application/match/tactical/CollectivePhaseSystem";
import { TacticalEngine } from "../../../src/application/match/tactical/TacticalEngine";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildSimulationConfig } from "../../helpers/builders";

describe("collective tactical phases", () => {
  const initialize = () => new MatchInitializer().initialize(buildSimulationConfig(3)).state;

  it("moves through attacking zones after the transition window", () => {
    const state = initialize();
    const phases = new CollectivePhaseSystem();
    phases.update(state);
    expect(state.home.collectivePhase).toBe("ATTACKING_TRANSITION");
    expect(state.away.collectivePhase).toBe("DEFENSIVE_TRANSITION");

    state.currentSecond = 5;
    state.ball.position = new Vector2(20, 34);
    phases.update(state);
    expect(state.home.collectivePhase).toBe("BUILD_UP");

    state.ball.position = new Vector2(55, 34);
    phases.update(state);
    expect(state.home.collectivePhase).toBe("PROGRESSION");

    state.ball.position = new Vector2(85, 34);
    phases.update(state);
    expect(state.home.collectivePhase).toBe("FINAL_THIRD");
  });

  it("enters defensive transition immediately after losing possession", () => {
    const state = initialize();
    const phases = new CollectivePhaseSystem();
    phases.update(state);
    const awayOwner = state.away.players[5];
    state.home.players.forEach(player => player.hasBall = false);
    awayOwner.hasBall = true;
    state.ball.owner = awayOwner;
    phases.update(state);

    expect(state.home.collectivePhase).toBe("DEFENSIVE_TRANSITION");
    expect(state.away.collectivePhase).toBe("ATTACKING_TRANSITION");
  });

  it("holds the awarded team in set-piece phase after a corner", () => {
    const state = initialize();
    const phases = new CollectivePhaseSystem();
    phases.update(state, [{
      id: "corner-1",
      type: "CORNER",
      timestamp: 0,
      period: "FIRST_HALF",
      teamId: state.home.team.id,
    }]);

    expect(state.home.collectivePhase).toBe("SET_PIECE");
    expect(state.away.collectivePhase).toBe("DEFENSIVE_BLOCK");

    state.currentSecond = 2.9;
    phases.update(state);
    expect(state.home.collectivePhase).toBe("SET_PIECE");
  });

  it("pushes centre backs near halfway during a sustained final-third attack", () => {
    const state = initialize();
    state.home.collectivePhase = "FINAL_THIRD";
    state.ball.position = new Vector2(85, 34);
    const centreBack = state.home.players.find(player => player.currentRole === "CENTRE_BACK")!;

    new TacticalEngine().update(state);

    expect(centreBack.targetPosition.x).toBeGreaterThan(40);
  });

  it("keeps wide and central roles on distinct lanes", () => {
    const state = initialize();
    state.home.collectivePhase = "PROGRESSION";
    state.ball.position = new Vector2(60, 34);
    new TacticalEngine().update(state);
    const fullBack = state.home.players.find(player => player.currentRole === "FULL_BACK")!;
    const midfielder = state.home.players.find(player => player.currentRole === "CENTRAL_MIDFIELDER")!;

    expect(Math.abs(fullBack.targetPosition.y - midfielder.targetPosition.y)).toBeGreaterThan(8);
    expect(fullBack.targetPosition.x).not.toBe(midfielder.targetPosition.x);
  });
});

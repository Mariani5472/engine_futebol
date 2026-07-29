import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { PossessionSystem } from "../../../src/core/movement/PossessionSystem";
import { ReachCalculator } from "../../../src/core/movement/ReachCalculator";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { RestartSystem } from "../../../src/application/match/engine/RestartSystem";
import { buildSimulationConfig } from "../../helpers/builders";

describe("RestartSystem", () => {
  const initialize = () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(31)).state;
    state.kickoff = null;
    return state;
  };

  it("keeps opponents at the regulatory corner distance before execution", () => {
    const state = initialize();
    const system = new RestartSystem();
    const corner = new Vector2(105, 0);
    state.away.players[1].position = new Vector2(102, 2);
    system.setup(state, "CORNER", state.home, corner, 0);
    system.enforceWaitingPositions(state);
    expect(state.away.players.every(player => player.position.distanceTo(corner) >= 9.15 - 1e-6)).toBe(true);
    expect(system.update(state)).toBe(true);
  });

  it("keeps opponents outside the penalty area for a goal kick", () => {
    const state = initialize();
    const system = new RestartSystem();
    const position = new Vector2(6, 34);
    state.away.players.forEach((player, index) => player.position = new Vector2(8 + index * .2, 34));
    system.setup(state, "GOAL_KICK", state.home, position, 0);
    system.enforceWaitingPositions(state);
    const area = state.pitch.geometry.penaltyAreaLeft;
    expect(state.away.players.every(player => !(
      player.position.x >= area.x && player.position.x <= area.x + area.width
      && player.position.y >= area.y && player.position.y <= area.y + area.height
    ))).toBe(true);
  });

  it("forces a throw-in to another player and forbids the taker's second touch", () => {
    const state = initialize();
    const system = new RestartSystem();
    system.setup(state, "THROW_IN", state.home, new Vector2(45, 0), 0);
    const restart = state.restart!;
    expect(restart.receiverId).not.toBe(restart.takerId);
    state.currentSecond = restart.executeAt;
    expect(system.update(state)).toBe(false);
    expect(state.ball.intendedReceiverId).toBe(restart.receiverId);
    expect(state.ball.restrictedTouchPlayerId).toBe(restart.takerId);

    const taker = state.home.players.find(player => player.player.id === restart.takerId)!;
    for (const player of [...state.home.players, ...state.away.players]) {
      player.hasBall = false;
      if (player !== taker) player.position = new Vector2(90, 60);
    }
    state.ball.motion = null;
    state.ball.owner = null;
    state.ball.state = BallState.FREE;
    state.ball.position = taker.position;
    state.ball.velocity = Vector2.zero();
    new PossessionSystem(new SeededRandom(1), new ReachCalculator()).update(state);
    expect(state.ball.owner).not.toBe(taker);
  });
});

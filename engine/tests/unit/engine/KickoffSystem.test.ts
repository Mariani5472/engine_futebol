import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { KickoffSystem } from "../../../src/application/match/engine/KickoffSystem";
import { MatchEngine } from "../../../src/application/match/engine/MatchEngine";
import { buildSimulationConfig } from "../../helpers/builders";

describe("KickoffSystem", () => {
  it("keeps opponents in their half and outside the centre circle", () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(1)).state;
    const centre = { x: state.pitch.length / 2, y: state.pitch.width / 2 };

    expect(state.kickoff?.teamId).toBe(state.home.team.id);
    expect(state.away.players.every(player => player.position.x >= centre.x + .5)).toBe(true);
    expect(state.away.players.every(player => Math.hypot(player.position.x - centre.x, player.position.y - centre.y) >= 10 - 1e-6)).toBe(true);
  });

  it("forces the taker to pass backwards to a teammate in its own half", () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(1)).state;
    const kickoff = state.kickoff!;
    const system = new KickoffSystem();
    const receiver = state.home.players.find(player => player.player.id === kickoff.receiverId)!;
    const taker = state.home.players.find(player => player.player.id === kickoff.takerId)!;

    expect(system.update(state)).toBe(true);
    state.currentSecond = kickoff.executeAt;
    expect(system.update(state)).toBe(false);

    expect(state.ball.motion?.intendedReceiverId).toBe(receiver.player.id);
    expect(state.ball.pendingPass?.passerId).toBe(taker.player.id);
    expect(receiver.position.x).toBeLessThan(state.pitch.length / 2);
    expect(state.ball.motion!.target.x).toBeLessThan(state.ball.motion!.origin.x);
  });

  it("gives the second-half kickoff to the team that did not start", () => {
    const config = { ...buildSimulationConfig(2), maxDurationSeconds: 4 };
    const iterator = new MatchEngine().runIncrementally(config);
    let secondHalfState: ReturnType<MatchInitializer["initialize"]>["state"] | undefined;
    for (let index = 0; index < 100; index++) {
      const step = iterator.next();
      if (step.done) break;
      if (step.value.period === "SECOND_HALF") { secondHalfState = step.value.state; break; }
    }

    expect(secondHalfState).toBeDefined();
    expect(secondHalfState!.kickoff?.teamId).toBe(secondHalfState!.away.team.id);
    expect(secondHalfState!.ball.position.x).toBeCloseTo(secondHalfState!.pitch.length / 2);
    expect(secondHalfState!.ball.position.y).toBeCloseTo(secondHalfState!.pitch.width / 2);
  });
});

import { TacticalDiagnosticsCollector } from "../../../src/application/match/diagnostics/TacticalDiagnosticsCollector";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildSimulationConfig } from "../../helpers/builders";

describe("TacticalDiagnosticsCollector", () => {
  it("measures collective shape, progression, transitions, PPDA and circulation", () => {
    const state = new MatchInitializer().initialize(buildSimulationConfig(31)).state;
    const collector = new TacticalDiagnosticsCollector();
    const runner = state.home.players.find(player => player.currentRole === "STRIKER")!;
    const defender = state.home.players.find(player => player.currentRole === "CENTRE_BACK")!;
    const opponent = state.away.players.find(player => player.currentRole === "CENTRAL_MIDFIELDER")!;

    runner.position = new Vector2(55, 34);
    state.ball.owner = state.home.players[6];
    state.ball.position = new Vector2(45, 34);
    state.ball.visualPosition = state.ball.position;
    collector.sample(state, .05);

    runner.position = new Vector2(72, 34);
    state.ball.position = new Vector2(52, 34);
    state.ball.visualPosition = state.ball.position;
    collector.sample(state, .05);
    runner.position = new Vector2(94, 34);
    state.ball.position = new Vector2(60, 34);
    state.ball.visualPosition = state.ball.position;
    collector.sample(state, .05);

    state.home.collectivePhase = "ATTACKING_TRANSITION";
    state.currentSecond = 10;
    collector.sample(state, .05);
    state.home.collectivePhase = "PROGRESSION";
    state.currentSecond = 13.2;
    collector.sample(state, .05);

    collector.onActionStarted(opponent, DecisionType.PASS, state);
    collector.onActionStarted(defender, DecisionType.TACKLE, state);
    const result = collector.snapshot().home;

    expect(result.averageLineHeight.defence).toBeGreaterThan(0);
    expect(result.blockWidth).toBeGreaterThan(0);
    expect(result.blockDepth).toBeGreaterThan(0);
    expect(result.finalThirdEntries).toBeGreaterThan(0);
    expect(result.penaltyAreaEntries).toBeGreaterThan(0);
    expect(result.progressiveRuns).toBeGreaterThan(0);
    expect(result.averageTransitionSeconds).toBeCloseTo(3.2, 1);
    expect(result.ppda).toBe(1);
    expect(result.ballCirculationSpeed).toBeGreaterThan(0);
    expect(result.averagePositionByRole.STRIKER.samples).toBeGreaterThan(0);
  });
});

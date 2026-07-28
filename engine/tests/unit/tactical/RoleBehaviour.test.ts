import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { TacticalEngine } from "../../../src/application/match/tactical/TacticalEngine";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildSimulationConfig } from "../../helpers/builders";

describe("role spatial behaviour", () => {
  const initialize = () => new MatchInitializer().initialize(buildSimulationConfig(9)).state;

  it("makes a false nine drop below the forward running beyond him", () => {
    const state = initialize();
    const forwards = state.home.players.filter(player => player.currentRole === "STRIKER");
    forwards[0].currentRole = "FALSE_NINE";
    forwards[1].currentRole = "INSIDE_FORWARD";
    state.home.collectivePhase = "FINAL_THIRD";
    state.ball.position = new Vector2(72, 34);
    new TacticalEngine().update(state);

    expect(forwards[0].targetPosition.x).toBeLessThan(forwards[1].targetPosition.x - 8);
    expect(Math.abs(forwards[0].targetPosition.y - state.pitch.width / 2)).toBeLessThan(4);
  });

  it("moves a box-to-box midfielder through defensive and attacking thirds", () => {
    const state = initialize();
    const midfielder = state.home.players.find(player => player.currentRole === "CENTRAL_MIDFIELDER")!;
    midfielder.currentRole = "BOX_TO_BOX_MIDFIELDER";
    state.home.collectivePhase = "DEFENSIVE_BLOCK";
    state.ball.position = new Vector2(24, 34);
    new TacticalEngine().update(state);
    const defensiveX = midfielder.targetPosition.x;

    state.home.collectivePhase = "FINAL_THIRD";
    state.ball.position = new Vector2(78, 34);
    new TacticalEngine().update(state);
    expect(defensiveX).toBeLessThan(50);
    expect(midfielder.targetPosition.x).toBeGreaterThan(68);
  });

  it("moves an inverted full-back centrally while a full-back keeps width", () => {
    const state = initialize();
    const fullBacks = state.home.players.filter(player => player.currentRole === "FULL_BACK");
    fullBacks[0].currentRole = "INVERTED_FULL_BACK";
    state.home.collectivePhase = "PROGRESSION";
    state.ball.position = new Vector2(58, 34);
    new TacticalEngine().update(state);

    const invertedDistance = Math.abs(fullBacks[0].targetPosition.y - state.pitch.width / 2);
    const wideDistance = Math.abs(fullBacks[1].targetPosition.y - state.pitch.width / 2);
    expect(invertedDistance).toBeLessThan(wideDistance - 8);
  });

  it("gives specialist roles different position maps", () => {
    const state = initialize();
    const centreBacks = state.home.players.filter(player => player.currentRole === "CENTRE_BACK");
    centreBacks[0].currentRole = "BALL_PLAYING_CENTRE_BACK";
    centreBacks[1].currentRole = "WIDE_CENTRE_BACK";
    state.home.collectivePhase = "BUILD_UP";
    state.ball.position = new Vector2(48, 34);
    new TacticalEngine().update(state);

    expect(centreBacks[0].targetPosition.distanceTo(centreBacks[1].targetPosition)).toBeGreaterThan(8);
    expect(Math.abs(centreBacks[1].targetPosition.y - state.pitch.width / 2)).toBeGreaterThan(12);
  });
});

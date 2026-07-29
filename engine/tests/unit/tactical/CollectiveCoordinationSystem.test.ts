import { CollectiveCoordinationSystem } from "../../../src/application/match/tactical/CollectiveCoordinationSystem";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallMotionPlanner } from "../../../src/application/match/physics/BallMotionPlanner";
import { buildSimulationConfig } from "../../helpers/builders";

describe("CollectiveCoordinationSystem", () => {
  const buildState = () => new MatchInitializer().initialize(buildSimulationConfig(7)).state;

  it("creates a presser, cover player and passing-lane shadow", () => {
    const state = buildState();
    const owner = state.away.players[8];
    owner.hasBall = true; state.ball.owner = owner; state.ball.position = owner.position;
    state.away.players.forEach(player => { if (player !== owner) player.hasBall = false; });
    state.home.collectivePhase = "DEFENSIVE_TRANSITION";
    new CollectiveCoordinationSystem().update(state);
    const duties = state.home.players.map(player => player.tacticalResponsibility);
    expect(duties).toContain("PRESSER");
    expect(duties).toContain("PRESS_COVER");
    expect(duties).toContain("COVER_SHADOW");
    const coordinated = state.home.players.filter(player => ["PRESSER", "PRESS_COVER", "COVER_SHADOW"].includes(player.tacticalResponsibility ?? ""));
    expect(new Set(coordinated.map(player => `${player.targetPosition.x.toFixed(1)}:${player.targetPosition.y.toFixed(1)}`)).size).toBe(3);
  });

  it("keeps rest defence and assigns three distinct penalty-area occupations", () => {
    const state = buildState();
    const owner = state.home.players[8];
    owner.position = new Vector2(80, 12); owner.hasBall = true;
    state.ball.owner = owner; state.ball.position = owner.position;
    state.home.collectivePhase = "FINAL_THIRD";
    new CollectiveCoordinationSystem().update(state);
    const rest = state.home.players.filter(player => player.tacticalResponsibility === "REST_DEFENCE");
    expect(rest).toHaveLength(2);
    expect(rest.every(player => player.targetPosition.x < state.ball.position.x)).toBe(true);
    const near = state.home.players.find(player => player.tacticalResponsibility === "ATTACK_NEAR_POST");
    const far = state.home.players.find(player => player.tacticalResponsibility === "ATTACK_FAR_POST");
    const edge = state.home.players.find(player => player.tacticalResponsibility === "BOX_EDGE_COVER");
    expect(near).toBeDefined(); expect(far).toBeDefined(); expect(edge).toBeDefined();
    expect(new Set([near!.targetPosition.y, far!.targetPosition.y, edge!.targetPosition.y]).size).toBe(3);
    expect(state.pitch.length - near!.targetPosition.x).toBeGreaterThanOrEqual(9);
    expect(state.pitch.length - far!.targetPosition.x).toBeGreaterThanOrEqual(9);
  });

  it("assigns every off-ball player to an explicit spatial channel", () => {
    const state = buildState();
    new CollectiveCoordinationSystem().update(state);
    expect([...state.home.players, ...state.away.players].filter(player => !player.hasBall)
      .every(player => player.occupiedChannel !== null)).toBe(true);
  });

  it("reacts collectively to a travelling ball without creating a crowd", () => {
    const state = buildState();
    const passer = state.home.players[5];
    const receiver = state.home.players[8];
    const target = new Vector2(66, 29);
    state.ball.pendingPass = {
      passerId: passer.player.id,
      intendedReceiverId: receiver.player.id,
      startedAtSecond: 2,
      realForwardGain: 14,
    };
    BallMotionPlanner.start(state.ball, {
      kind: "GROUND_PASS", origin: passer.position, target, speed: 18,
      intendedReceiverId: receiver.player.id,
    });

    new CollectiveCoordinationSystem().update(state);

    expect(receiver.tacticalResponsibility).toBe("RECEIVE_RUN");
    expect(receiver.targetPosition).toEqual(target);
    for (const team of [state.home, state.away]) {
      expect(team.players.filter(player => ["RECEIVE_RUN", "LOOSE_BALL_CHASER"].includes(player.tacticalResponsibility ?? ""))).toHaveLength(1);
      expect(team.players.some(player => player.tacticalResponsibility === "SECOND_BALL_COVER")).toBe(true);
      expect(team.players.some(player => player.tacticalResponsibility === "LOOSE_BALL_OUTLET")).toBe(true);
    }
  });

  it("sends only the ball-side fullback forward and balances the far side", () => {
    const state = buildState();
    const owner = state.home.players.find(player => player.currentRole === "WIDE_MIDFIELDER" && player.position.y < state.pitch.width / 2)!;
    owner.position = new Vector2(58, 9);
    owner.hasBall = true;
    state.ball.owner = owner;
    state.ball.position = owner.position;
    state.home.collectivePhase = "PROGRESSION";
    const fullbacksBefore = state.home.players.filter(player => String(player.currentRole).includes("FULL_BACK"));
    // Even if both temporarily drift into the same half, their formation
    // anchors must preserve left/right responsibility.
    fullbacksBefore.forEach((player, index) => player.position = new Vector2(42, 20 + index * 5));

    const coordination = new CollectiveCoordinationSystem();
    coordination.update(state);

    const fullbacks = state.home.players.filter(player => String(player.currentRole).includes("FULL_BACK"));
    expect(fullbacks.some(player => ["OVERLAP", "UNDERLAP"].includes(player.tacticalResponsibility ?? ""))).toBe(true);
    expect(fullbacks.some(player => player.tacticalResponsibility === "FAR_SIDE_BALANCE")).toBe(true);
  });

  it("does not accumulate third-man displacement on repeated ticks", () => {
    const state = buildState();
    const owner = state.home.players[6];
    owner.hasBall = true; state.ball.owner = owner; state.ball.position = owner.position;
    state.home.collectivePhase = "PROGRESSION";
    const coordination = new CollectiveCoordinationSystem();
    coordination.update(state);
    const runner = state.home.players.find(player => player.tacticalResponsibility === "THIRD_MAN_RUN")!;
    const support = state.home.players.find(player => player.tacticalResponsibility === "THIRD_MAN_SUPPORT")!;
    const firstTarget = runner.targetPosition;

    expect(support.thirdManOriginId).toBe(owner.player.id);
    expect(support.thirdManNextTargetId).toBe(runner.player.id);
    expect(support.thirdManAvailableUntil).toBeGreaterThan(state.currentSecond);

    state.currentSecond += .05;
    coordination.update(state);

    expect(runner.targetPosition.distanceTo(firstTarget)).toBeLessThan(1);
  });
});

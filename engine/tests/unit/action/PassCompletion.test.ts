import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { PossessionSystem } from "../../../src/core/movement/PossessionSystem";
import { ReachCalculator } from "../../../src/core/movement/ReachCalculator";
import { PassAction } from "../../../src/application/match/action/actions/PassAction";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { BallPhysicsSystem } from "../../../src/application/match/physics/BallPhysicsSystem";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { buildMinimalMatchState } from "../../helpers/builders";
import { ActionContext } from "../../../src/application/match/action/ActionContext";

describe("authoritative pass flow", () => {
  function buildContext(seed = 1) {
    const match = buildMinimalMatchState();
    const passer = match.home.players[0];
    const receiver = match.home.players[1];
    passer.position = new Vector2(50, 34);
    receiver.position = new Vector2(65, 40);
    passer.hasBall = true;
    match.ball.owner = passer;
    match.ball.state = BallState.CONTROLLED;
    match.ball.position = passer.position;
    const decision = new Decision(DecisionType.PASS, 80, receiver.player.id);
    const ctx: ActionContext = {
      player: passer, decision, match, pitch: match.pitch,
      random: new SeededRandom(seed), tick: 1, deltaTime: .05,
      teamSide: "HOME", attackingDirection: 1, matchSecond: 10,
    };
    return { match, passer, receiver, ctx };
  }

  it("launches the ball without instantly transferring ownership", () => {
    const { match, passer, receiver, ctx } = buildContext();
    const origin = match.ball.position;
    const result = new PassAction().execute(ctx);

    expect(result.success).toBe(true); // the kick was executed, reception is pending
    expect(passer.hasBall).toBe(false);
    expect(receiver.hasBall).toBe(false);
    expect(match.ball.owner).toBeNull();
    expect(match.ball.state).toBe(BallState.IN_FLIGHT);
    expect(match.ball.position).toEqual(origin);
    expect(match.ball.intendedReceiverId).toBe(receiver.player.id);
    expect(match.ball.pendingPass?.intendedReceiverId).toBe(receiver.player.id);
    expect(match.ball.drainPossessionAcquisitions()).toHaveLength(0);
  });

  it("leads a moving receiver instead of aiming at the stale position", () => {
    const { match, receiver, ctx } = buildContext();
    receiver.velocity = new Vector2(4, 1);
    const oldPosition = receiver.position;

    new PassAction().execute(ctx);

    expect(match.ball.motion!.target.x).toBeGreaterThan(oldPosition.x);
    expect(match.ball.motion!.target.y).toBeGreaterThan(oldPosition.y);
    expect(match.ball.motion!.target.distanceTo(oldPosition)).toBeLessThanOrEqual(5.5);
  });

  it("keeps the passer moving and offers an organic one-two return", () => {
    const { passer, receiver, ctx } = buildContext();
    new PassAction().execute(ctx);

    expect(passer.oneTwoPartnerId).toBe(receiver.player.id);
    expect(passer.oneTwoRunTarget?.x).toBeGreaterThan(passer.position.x);
    expect(receiver.oneTwoReturnTargetId).toBe(passer.player.id);
    expect(passer.tacticalResponsibility).toBe("ONE_TWO_RUN");
  });

  it("keeps logical and visual ball positions identical throughout flight", () => {
    const { match, ctx } = buildContext();
    new PassAction().execute(ctx);
    const physics = new BallPhysicsSystem();
    for (let i = 0; i < 200 && match.ball.motion; i++) {
      physics.update(match, .05);
      expect(match.ball.visualPosition.distanceTo(match.ball.position)).toBeLessThan(1e-9);
    }
    expect(match.ball.motion).toBeNull();
    expect(match.ball.state).toBe(BallState.FREE);
  });

  it("resolves pass success only when the intended receiver controls it", () => {
    let controlled = false;
    for (let seed = 1; seed <= 30 && !controlled; seed++) {
      const { match, receiver, ctx } = buildContext(seed);
      new PassAction().execute(ctx);
      match.ball.motion = null;
      match.ball.state = BallState.FREE;
      match.ball.position = receiver.position.add(new Vector2(.5, 0));
      match.ball.velocity = Vector2.zero();
      new PossessionSystem(new SeededRandom(seed), new ReachCalculator()).update(match);
      if (match.ball.owner !== receiver) continue;
      const resolution = match.ball.drainPassResolutions()[0];
      expect(resolution).toMatchObject({
        type: "PASS_RESOLVED", success: true,
        controllingPlayerId: receiver.player.id,
      });
      expect(match.ball.position.distanceTo(receiver.position)).toBeCloseTo(.5);
      controlled = true;
    }
    expect(controlled).toBe(true);
  });

  it("credits a completed pass when another teammate collects the intended ball",()=>{
    const {match,ctx}=buildContext(7);
    const teammate=match.away.players[0];
    new PassAction().execute(ctx);
    match.ball.pendingPass={...match.ball.pendingPass!,teammateIds:[match.home.players[1].player.id,teammate.player.id]};
    match.ball.resolvePendingPass(teammate.player.id,10.8);
    expect(match.ball.drainPassResolutions()[0]).toMatchObject({
      success:true,
      controllingPlayerId:teammate.player.id,
    });
  });

  it("does not claim a stopped ball outside the physical control radius", () => {
    const { match, receiver } = buildContext();
    for (const player of [...match.home.players, ...match.away.players]) {
      player.position = new Vector2(0, 0);
      player.hasBall = false;
    }
    receiver.position = new Vector2(11.16, 10);
    match.ball.release();
    match.ball.motion = null;
    match.ball.state = BallState.FREE;
    match.ball.position = new Vector2(10, 10);
    match.ball.velocity = Vector2.zero();
    const before = match.ball.position;
    new PossessionSystem(new SeededRandom(1), new ReachCalculator()).update(match);
    expect(match.ball.owner).toBeNull();
    expect(match.ball.position).toEqual(before);
  });

  it("allows an opponent to intercept the segment crossed during a tick", () => {
    let intercepted = false;
    for (let seed = 1; seed <= 30 && !intercepted; seed++) {
      const { match, passer, receiver, ctx } = buildContext(seed);
      for (const player of [...match.home.players, ...match.away.players]) {
        if (player !== passer && player !== receiver) player.position = new Vector2(0, 0);
      }
      passer.position = new Vector2(10, 34);
      receiver.position = new Vector2(30, 34);
      match.ball.position = passer.position;
      const interceptor = match.away.players[0];
      interceptor.position = new Vector2(16, 34);
      new PassAction().execute(ctx);
      new BallPhysicsSystem().update(match, .5);
      new PossessionSystem(new SeededRandom(seed), new ReachCalculator()).update(match);
      if (match.ball.owner !== interceptor) continue;
      const acquisition = match.ball.drainPossessionAcquisitions()[0];
      expect(acquisition).toMatchObject({
        playerId: interceptor.player.id,
        reason: "INTERCEPTION",
        wasLoose: true,
      });
      // Segment interception preserves the real perpendicular contact
      // distance; it must be inside the physical radius, not rewritten to 0.
      expect(acquisition.distanceToBall).toBeLessThanOrEqual(.85);
      expect(match.ball.drainPassResolutions()[0]?.success).toBe(false);
      intercepted = true;
    }
    expect(intercepted).toBe(true);
  });

  it("classifies an elevated opponent contest as one aerial duel", () => {
    let acquisitionFound = false;
    for (let seed = 1; seed <= 40 && !acquisitionFound; seed++) {
      const { match, passer, receiver } = buildContext(seed);
      const opponent = match.away.players[0];
      for (const player of [...match.home.players, ...match.away.players]) {
        player.position = new Vector2(0, 0);
        player.hasBall = false;
      }
      receiver.position = new Vector2(16, 34);
      opponent.position = new Vector2(16.1, 34);
      match.ball.release();
      match.ball.state = BallState.IN_FLIGHT;
      match.ball.previousPosition = new Vector2(15, 34);
      match.ball.position = new Vector2(17, 34);
      match.ball.velocity = new Vector2(12, 0);
      match.ball.height = 1.8;
      match.ball.intendedReceiverId = receiver.player.id;
      match.ball.pendingPass = {
        passerId: passer.player.id, intendedReceiverId: receiver.player.id,
        teammateIds: [receiver.player.id], startedAtSecond: 0, realForwardGain: 6,
      };
      new PossessionSystem(new SeededRandom(seed), new ReachCalculator()).update(match);
      const acquisition = match.ball.drainPossessionAcquisitions()[0];
      if (!acquisition) continue;
      expect(acquisition).toMatchObject({ contested: true, duelKind: "AERIAL" });
      expect([receiver.player.id, opponent.player.id]).toContain(acquisition.playerId);
      acquisitionFound = true;
    }
    expect(acquisitionFound).toBe(true);
  });
});

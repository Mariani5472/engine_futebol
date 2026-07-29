import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { PossessionSystem } from "../../../src/core/movement/PossessionSystem";
import { ReachCalculator } from "../../../src/core/movement/ReachCalculator";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { BallPhysicsSystem } from "../../../src/application/match/physics/BallPhysicsSystem";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("Possession stability", () => {
  it("reclaims orphan CONTROLLED ball (owner null)", () => {
    const match = buildMinimalMatchState();
    const near = match.home.players[0];
    for (const player of [...match.home.players, ...match.away.players]) {
      player.position = new Vector2(0, 0);
    }
    near.position = new Vector2(52, 34);
    near.hasBall = false;

    match.ball.owner = null;
    match.ball.state = BallState.CONTROLLED; // illegal orphan state
    match.ball.position = near.position;
    match.ball.velocity = Vector2.zero();

    // Physics should mark FREE
    new BallPhysicsSystem().update(match, 0.5);
    expect(match.ball.state).toBe(BallState.FREE);

    const possession = new PossessionSystem(new SeededRandom(1), new ReachCalculator());
    for (let attempt = 0; attempt < 20 && !match.ball.owner; attempt++) {
      match.currentSecond = attempt * .7;
      possession.update(match);
    }

    expect(match.ball.owner).not.toBeNull();
    expect(match.ball.state).toBe(BallState.CONTROLLED);
    expect(match.ball.owner!.hasBall).toBe(true);

    const owners = [...match.home.players, ...match.away.players].filter((p) => p.hasBall);
    expect(owners).toHaveLength(1);
  });

  it("keeps owner and hasBall in sync while CONTROLLED", () => {
    const match = buildMinimalMatchState();
    const owner = match.home.players[0];
    owner.position = new Vector2(60, 30);
    owner.hasBall = true;
    match.ball.owner = owner;
    match.ball.state = BallState.CONTROLLED;
    match.ball.position = owner.position;

    const possession = new PossessionSystem(new SeededRandom(2), new ReachCalculator());
    possession.update(match);

    expect(match.ball.owner).toBe(owner);
    expect(owner.hasBall).toBe(true);
    expect(match.home.players[1].hasBall).toBe(false);
  });

  it("claims FREE ball when a player is in reach", () => {
    const match = buildMinimalMatchState();
    const p = match.home.players[0];
    for (const player of [...match.home.players, ...match.away.players]) {
      player.position = new Vector2(0, 0);
    }
    p.position = new Vector2(40, 20);
    p.hasBall = false;

    match.ball.owner = null;
    match.ball.state = BallState.FREE;
    match.ball.position = new Vector2(40.5, 20.2);
    match.ball.velocity = Vector2.zero();

    const possession = new PossessionSystem(new SeededRandom(3), new ReachCalculator());
    for (let attempt = 0; attempt < 20 && !match.ball.owner; attempt++) {
      match.currentSecond = attempt * .7;
      possession.update(match);
    }

    expect(match.ball.owner).toBe(p);
    expect(p.hasBall).toBe(true);
    expect(match.ball.state).toBe(BallState.CONTROLLED);
  });

  it("usually deflects a 25m/s interception instead of granting clean control", () => {
    let cleanControls = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const match = buildMinimalMatchState();
      const interceptor = match.away.players[0];
      for (const player of [...match.home.players, ...match.away.players]) player.position = new Vector2(0, 0);
      interceptor.position = new Vector2(11, 10);
      interceptor.facingDirection = new Vector2(-1, 0);
      match.ball.release();
      match.ball.state = BallState.IN_FLIGHT;
      match.ball.previousPosition = new Vector2(10, 10);
      match.ball.position = new Vector2(12, 10);
      match.ball.velocity = new Vector2(25, 0);
      match.ball.height = 0;
      match.ball.intendedReceiverId = match.home.players[1].player.id;
      new PossessionSystem(new SeededRandom(seed), new ReachCalculator()).update(match);
      if (match.ball.owner === interceptor) cleanControls++;
    }
    expect(cleanControls).toBeLessThanOrEqual(8);
  });
});

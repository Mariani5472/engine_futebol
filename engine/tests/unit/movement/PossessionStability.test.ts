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
    possession.update(match);

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
    p.position = new Vector2(40, 20);
    p.hasBall = false;

    match.ball.owner = null;
    match.ball.state = BallState.FREE;
    match.ball.position = new Vector2(40.5, 20.2);
    match.ball.velocity = Vector2.zero();

    const possession = new PossessionSystem(new SeededRandom(3), new ReachCalculator());
    possession.update(match);

    expect(match.ball.owner).toBe(p);
    expect(p.hasBall).toBe(true);
    expect(match.ball.state).toBe(BallState.CONTROLLED);
  });
});

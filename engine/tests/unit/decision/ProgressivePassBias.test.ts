import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { PlayerMemory } from "../../../src/application/match/awareness/memory/PlayerMemory";
import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { PassEvaluator } from "../../../src/application/match/decision/evaluators/PassEvaluator";
import { buildMinimalMatchState, buildPlayerMatchState } from "../../helpers/builders";

describe("Progressive pass bias", () => {
  it("prefers a teammate ahead over a lateral option", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    const lateral = match.home.players[1];
    const ahead = buildPlayerMatchState({
      position: new Vector2(75, 34),
      role: "STRIKER",
    });
    match.home.players.push(ahead);

    carrier.position = new Vector2(55, 34);
    carrier.hasBall = true;
    carrier.facingDirection = new Vector2(1, 0);
    carrier.balance = 100;
    carrier.stability = 100;

    lateral.position = new Vector2(55, 48);
    ahead.position = new Vector2(75, 34);

    match.away.players[0].position = new Vector2(20, 10);
    match.ball.owner = carrier;
    match.ball.state = BallState.CONTROLLED;
    match.ball.position = carrier.position;

    const awareness = PlayerAwareness.create(carrier.player.id);
    awareness.teammates.set(
      lateral.player.id,
      PlayerMemory.create(lateral.player.id, lateral.position, 0),
    );
    awareness.teammates.set(
      ahead.player.id,
      PlayerMemory.create(ahead.player.id, ahead.position, 0),
    );

    const world = new WorldAwarenessSystem().build(match, carrier, awareness);
    const ctx = new DecisionContext(match, carrier, awareness, 0, 0.5, world);

    const decisions = new PassEvaluator().evaluate(ctx);
    const byTarget = new Map(decisions.map((d) => [d.targetId, d.utility]));

    // eslint-disable-next-line no-console
    console.log(
      "utilities",
      [...byTarget.entries()].map(([id, u]) => `${id}=${u.toFixed(1)}`),
      "lanes",
      world.passingLanes.map((l) => `${l.targetId} fp=${l.forwardProgress.toFixed(1)}`),
    );

    const aheadU = byTarget.get(ahead.player.id) ?? 0;
    const lateralU = byTarget.get(lateral.player.id) ?? 0;

    expect(aheadU).toBeGreaterThan(lateralU);
    expect(aheadU).toBeGreaterThan(0);
  });

  it("prefers an open medium option over a crowded two-metre pass", () => {
    const match = buildMinimalMatchState();
    const carrier = match.home.players[0];
    const close = match.home.players[1];
    const open = buildPlayerMatchState({ position: new Vector2(58, 46), role: "MIDFIELDER" });
    match.home.players.push(open);
    carrier.position = new Vector2(55, 34);
    close.position = new Vector2(57, 34);
    carrier.hasBall = true;
    carrier.facingDirection = new Vector2(1, 0);
    match.ball.owner = carrier;
    match.ball.state = BallState.CONTROLLED;
    match.ball.position = carrier.position;
    match.away.players[0].position = new Vector2(57, 35);

    const awareness = PlayerAwareness.create(carrier.player.id);
    awareness.teammates.set(close.player.id, PlayerMemory.create(close.player.id, close.position, 0));
    awareness.teammates.set(open.player.id, PlayerMemory.create(open.player.id, open.position, 0));
    const world = new WorldAwarenessSystem().build(match, carrier, awareness);
    const decisions = new PassEvaluator().evaluate(new DecisionContext(match, carrier, awareness, 0, .05, world));
    const utility = new Map(decisions.map(decision => [decision.targetId, decision.utility]));
    expect(utility.get(open.player.id) ?? 0).toBeGreaterThan(utility.get(close.player.id) ?? 0);
  });
});

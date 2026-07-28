import { Vector2 } from "../../../src/core/geometry/Vector2";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { PlayerMemory } from "../../../src/application/match/awareness/memory/PlayerMemory";
import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { createPossessionEvaluators } from "../../../src/application/match/decision/possession/PossessionEvaluators";
import { PossessionDecisionSystem } from "../../../src/application/match/decision/possession/PossessionDecisionSystem";
import { buildMinimalMatchState } from "../../helpers/builders";

function setupCarrier(opts: {
  x: number;
  y?: number;
  pressureOpponent?: boolean;
  lastAction?: DecisionType;
}) {
  const match = buildMinimalMatchState();
  const carrier = match.home.players[0];
  const support = match.home.players[1];

  carrier.position = new Vector2(opts.x, opts.y ?? 34);
  carrier.hasBall = true;
  carrier.facingDirection = new Vector2(1, 0);
  carrier.balance = 100;
  carrier.stability = 100;
  carrier.bodyState = "STANDING";
  carrier.lastActionType = opts.lastAction;

  support.position = new Vector2(Math.min(100, opts.x + 18), 40);
  support.hasBall = false;

  if (opts.pressureOpponent) {
    match.away.players[0].position = new Vector2(opts.x + 1.2, 34);
  } else {
    match.away.players[0].position = new Vector2(20, 10);
  }

  match.ball.owner = carrier;
  match.ball.position = carrier.position;
  match.ball.state = BallState.CONTROLLED;

  const awareness = PlayerAwareness.create(carrier.player.id);
  awareness.teammates.set(
    support.player.id,
    PlayerMemory.create(support.player.id, support.position, 0),
  );

  const world = new WorldAwarenessSystem().build(match, carrier, awareness);
  const ctx = new DecisionContext(match, carrier, awareness, 0, 0.5, world);
  return { match, carrier, ctx, world };
}

function utilities(ctx: DecisionContext): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of createPossessionEvaluators()) {
    for (const d of ev.evaluate(ctx)) {
      const name = DecisionType[d.type] ?? String(d.type);
      out[name] = Math.max(out[name] ?? 0, d.utility);
    }
  }
  return out;
}

describe("Possession balance after anti-dribble monopoly fix", () => {
  it("does not rank DRIBBLE as the runaway leader in open midfield with a progressive lane", () => {
    const { ctx } = setupCarrier({ x: 55 });
    const u = utilities(ctx);

    // eslint-disable-next-line no-console
    console.log("open midfield utilities", u);

    expect(u.PASS ?? 0).toBeGreaterThan(0);
    if ((u.PASS ?? 0) > 0) {
      expect(u.DRIBBLE ?? 0).toBeLessThan((u.PASS ?? 1) * 2.5);
    }
  });

  it("raises HOLD_BALL under heavy pressure above mindless DRIBBLE", () => {
    const { ctx, world } = setupCarrier({ x: 60, pressureOpponent: true });
    const u = utilities(ctx);

    // eslint-disable-next-line no-console
    console.log("under pressure utilities", u, "pressure", world.pressure);

    expect(world.pressure).toBeGreaterThan(0.4);
    expect(u.HOLD_BALL ?? 0).toBeGreaterThan(u.DRIBBLE ?? 0);
  });

  it("penalises immediate DRIBBLE repeat after lastAction=DRIBBLE", () => {
    const fresh = setupCarrier({ x: 55, lastAction: undefined });
    const repeat = setupCarrier({ x: 55, lastAction: DecisionType.DRIBBLE });

    const uFresh = utilities(fresh.ctx);
    const uRepeat = utilities(repeat.ctx);

    // eslint-disable-next-line no-console
    console.log("dribble fresh", uFresh.DRIBBLE, "repeat", uRepeat.DRIBBLE);

    expect(uRepeat.DRIBBLE ?? 0).toBeLessThan(uFresh.DRIBBLE ?? 0);
  });

  it("PossessionDecisionSystem selects PASS or HOLD more often than DRIBBLE under pressure", () => {
    const system = new PossessionDecisionSystem(createPossessionEvaluators());
    const { ctx, world } = setupCarrier({ x: 58, pressureOpponent: true });

    const decision = system.decide(ctx);
    const name = DecisionType[decision.type];

    // eslint-disable-next-line no-console
    console.log("selected under pressure", name, decision.utility, "p", world.pressure);

    expect(["PASS", "HOLD_BALL", "SHOT", "CLEAR", "CROSS"]).toContain(name);
  });
});

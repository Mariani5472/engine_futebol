import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { DecisionSystem } from "../../../src/application/match/decision/DecisionSystem";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { PassEvaluator } from "../../../src/application/match/decision/evaluators/PassEvaluator";
import { ShotEvaluator } from "../../../src/application/match/decision/evaluators/ShotEvaluator";
import { HoldBallEvaluator } from "../../../src/application/match/decision/evaluators/HoldBallEvaluator";
import { TackleEvaluator } from "../../../src/application/match/decision/evaluators/TackleEvaluator";
import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { PlayerMemory } from "../../../src/application/match/awareness/memory/PlayerMemory";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import {
  buildMinimalMatchState, buildPlayerMatchState, buildPlayer, buildAttributes
} from "../../helpers/builders";

function makeSystemWithAllEvaluators(): DecisionSystem {
  return new DecisionSystem([
    new PassEvaluator(),
    new ShotEvaluator(),
    new HoldBallEvaluator(),
    new TackleEvaluator(),
  ]);
}

function makeContextWithBall(awarenessOverrides?: (awareness: PlayerAwareness) => void): DecisionContext {
  const state = buildMinimalMatchState();
  const player = state.home.players[0];
  player.hasBall = true;
  (state.ball as any).owner = player;

  const awareness = PlayerAwareness.create(player.player.id);
  if (awarenessOverrides) awarenessOverrides(awareness);

  return new DecisionContext(state, player, awareness, 0, 0.5);
}

describe("DecisionSystem", () => {

  it("always returns a decision", () => {
    const system = makeSystemWithAllEvaluators();
    const ctx = makeContextWithBall();
    const decision = system.decide(ctx);
    expect(decision).toBeDefined();
    expect(decision.type).not.toBe(DecisionType.NONE);
  });

  it("ball carrier never gets TACKLE as a decision", () => {
    const system = makeSystemWithAllEvaluators();
    const ctx = makeContextWithBall();
    const decision = system.decide(ctx);
    expect(decision.type).not.toBe(DecisionType.TACKLE);
  });

  it("player with a visible teammate considers PASS", () => {
    const system = makeSystemWithAllEvaluators();
    const ctx = makeContextWithBall(awareness => {
      // Add a nearby teammate memory.
      const mem = PlayerMemory.create("teammate-1", new Vector2(60, 34), 0);
      awareness.teammates.set("teammate-1", mem);
    });

    // PASS should be in the candidate list (even if not selected).
    // We verify by running the evaluators directly.
    const passEval = new PassEvaluator();
    const candidates = passEval.evaluate(ctx);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].type).toBe(DecisionType.PASS);
  });

  it("returns a legal decision for a non-ball-carrier", () => {
    const system = makeSystemWithAllEvaluators();
    const state = buildMinimalMatchState();
    const nonBallCarrier = buildPlayerMatchState({ hasBall: false, position: new Vector2(50, 34) });
    state.home.players.splice(0, 0, nonBallCarrier);

    const awareness = PlayerAwareness.create(nonBallCarrier.player.id);
    const ctx = new DecisionContext(state, nonBallCarrier, awareness, 0, 0.5);

    const decision = system.decide(ctx);
    // Non-ball-carrier should never SHOOT or PASS.
    expect(decision.type).not.toBe(DecisionType.SHOT);
    expect(decision.type).not.toBe(DecisionType.PASS);
  });

});

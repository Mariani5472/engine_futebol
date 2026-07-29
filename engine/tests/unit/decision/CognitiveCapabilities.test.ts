import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { CognitiveCapabilityResolver } from "../../../src/application/match/decision/CognitiveCapabilities";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { buildAttributes, buildMinimalMatchState } from "../../helpers/builders";

describe("CognitiveCapabilityResolver", () => {
  it("gives better anticipation/vision a deeper and longer search without removing basic options", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[0];
    const awareness = PlayerAwareness.create(player.player.id);
    const resolver = new CognitiveCapabilityResolver();
    const context = () => new DecisionContext(state, player, awareness, 4, .05,
      new WorldAwarenessSystem().build(state, player, awareness));
    (player.player as unknown as {attributes:ReturnType<typeof buildAttributes>}).attributes = buildAttributes({vision:5,anticipation:5,decisions:5});
    const limited = resolver.resolve(context());
    (player.player as unknown as {attributes:ReturnType<typeof buildAttributes>}).attributes = buildAttributes({vision:18,anticipation:18,decisions:18});
    const elite = resolver.resolve(context());
    expect(elite.optionSearchDepth).toBeGreaterThan(limited.optionSearchDepth);
    expect(elite.predictionHorizon).toBeGreaterThan(limited.predictionHorizon);
    expect(limited.optionSearchDepth).toBeGreaterThanOrEqual(7);
  });

  it("produces exactly reproducible evaluation error for the same tick", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[0];
    const awareness = PlayerAwareness.create(player.player.id);
    const context = new DecisionContext(state, player, awareness, 20, .05,
      new WorldAwarenessSystem().build(state, player, awareness));
    const resolver = new CognitiveCapabilityResolver();
    const decision = new Decision(DecisionType.PASS, 50, state.home.players[1].player.id);
    expect(resolver.applyEvaluationError(decision, context).utility)
      .toBe(resolver.applyEvaluationError(decision, context).utility);
  });
});

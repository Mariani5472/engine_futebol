import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { GoalOpportunityAnalyzer } from "../../../src/application/match/decision/GoalOpportunityAnalyzer";
import { createPossessionEvaluators } from "../../../src/application/match/decision/possession/PossessionEvaluators";
import { PossessionDecisionSystem } from "../../../src/application/match/decision/possession/PossessionDecisionSystem";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { TacticalIntelligenceSystem } from "../../../src/application/match/tactical/intelligence/TacticalIntelligenceSystem";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("goal-oriented tactical decisions", () => {
  const scenario = () => {
    const state = buildMinimalMatchState();
    state.kickoff = null;
    const carrier = state.home.players[0];
    carrier.position = new Vector2(93, 34);
    carrier.facingDirection = new Vector2(1, 0);
    state.home.players[1].position = new Vector2(80, 44);
    state.away.players[0].position = new Vector2(103.5, 34);
    state.ball.position = carrier.position;
    state.ball.owner = carrier;
    const awareness = PlayerAwareness.create(carrier.player.id);
    const world = new WorldAwarenessSystem().build(state, carrier, awareness);
    const tactical = new TacticalIntelligenceSystem().update(state);
    return { state, carrier, context:new DecisionContext(state, carrier, awareness, 0, .05, world, tactical) };
  };

  it("recognizes a clear immediate shot rather than treating backward recycling as equal", () => {
    const { context } = scenario();
    const opportunity = new GoalOpportunityAnalyzer().analyze(context);
    expect(opportunity.shotAvailable).toBe(true);
    expect(opportunity.shotQuality).toBeGreaterThan(.2);
    expect(opportunity.teammateBetterPositioned).toBe(false);
  });

  it("normally selects SHOT for a free player facing goal", () => {
    const { context } = scenario();
    const decision = new PossessionDecisionSystem(createPossessionEvaluators()).decide(context);
    expect(decision.type).toBe(DecisionType.SHOT);
  });
});


import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import {
  SELF_TRAINING_STAGE_ORDER,
  trainingScenarioCatalog,
  trainingScenarioDefinition,
} from "../../../src/application/match/scenario/TrainingScenarioRegistry";
import { buildSimulationConfig } from "../../helpers/builders";

describe("TrainingScenarioRegistry", () => {
  it("publishes exactly one executable definition in self-training order", () => {
    const catalog = trainingScenarioCatalog();
    expect(catalog.map(definition => definition.id)).toEqual(SELF_TRAINING_STAGE_ORDER);
    expect(new Set(catalog.map(definition => definition.id)).size).toBe(catalog.length);
    for (const definition of catalog) {
      const scenarioId = definition.scenario.kind === "CURRICULUM"
        ? definition.scenario.stage
        : definition.scenario.kind === "FUNDAMENTAL" ? definition.scenario.skill : null;
      expect(scenarioId).toBe(definition.id);
      expect(definition.terminationRules.length).toBeGreaterThan(0);
      expect(definition.successRules.length).toBeGreaterThan(0);
      expect(definition.requiredCapabilities.length).toBeGreaterThan(0);
      expect(definition.rewardProfileId).not.toHaveLength(0);
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.difficulty)).toBe(true);
    }
  });

  it("returns stable definitions by ID", () => {
    expect(trainingScenarioDefinition("PASS")).toBe(trainingScenarioDefinition("PASS"));
    expect(trainingScenarioDefinition("SELF_PLAY")).toMatchObject({
      family: "FULL_MATCH",
      policyMode: "SELF_PLAY",
      opponentMode: "OPPONENT_POOL",
    });
  });

  it.each(SELF_TRAINING_STAGE_ORDER)("resets %s deterministically for the same seed", stage => {
    const scenario = trainingScenarioDefinition(stage).scenario;
    const first = new MatchInitializer().initialize({ ...buildSimulationConfig(7_001), scenario }).state;
    const second = new MatchInitializer().initialize({ ...buildSimulationConfig(7_001), scenario }).state;
    expect(project(first)).toEqual(project(second));
  });
});

function project(state: ReturnType<MatchInitializer["initialize"]>["state"]): unknown {
  return {
    ball: {
      owner: state.ball.owner?.player.id ?? null,
      position: [state.ball.position.x, state.ball.position.y],
      state: state.ball.state,
    },
    players: [...state.home.players, ...state.away.players].map(player => ({
      id: player.player.id,
      position: [player.position.x, player.position.y],
      facing: [player.facingDirection.x, player.facingDirection.y],
      frozen: player.scenarioMovementFrozen,
      disabled: player.scenarioDecisionDisabled,
    })),
  };
}

import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { createCurriculumScenarioPreset } from "../../../src/application/match/scenario/MatchScenario";
import { buildSimulationConfig } from "../../helpers/builders";

describe("curriculum scenarios", () => {
  it("builds every expansion stage with explicit participants and objective", () => {
    const stages = ["PASS", "TWO_V_ONE", "THREE_V_TWO", "FIVE_V_FIVE", "SEVEN_V_SEVEN", "LEARNED_GOALKEEPER", "ELEVEN_V_ELEVEN", "COLLECTIVE_POLICY", "SELF_PLAY"] as const;
    for (const stage of stages) {
      const scenario = createCurriculumScenarioPreset(stage);
      expect(scenario.stage).toBe(stage);
      expect(scenario.attackingPlayerIds).toContain(scenario.primaryBallCarrierId);
      expect(new Set([...scenario.attackingPlayerIds, ...scenario.defendingPlayerIds]).size)
        .toBe(scenario.attackingPlayerIds.length + scenario.defendingPlayerIds.length);
    }
    expect(createCurriculumScenarioPreset("PASS").objective).toBe("COMPLETE_PASS");
    expect(createCurriculumScenarioPreset("SELF_PLAY")).toMatchObject({
      objective: "PLAY_MATCH",
      goalkeeperMode: "EXTERNAL",
      isolateOtherPlayers: false,
    });
  });

  it.each(["TWO_V_ONE", "THREE_V_TWO", "FIVE_V_FIVE", "SEVEN_V_SEVEN", "ELEVEN_V_ELEVEN", "COLLECTIVE_POLICY", "SELF_PLAY"] as const)(
    "initializes %s with every declared participant active",
    stage => {
      const scenario = createCurriculumScenarioPreset(stage);
      const state = new MatchInitializer().initialize({ ...buildSimulationConfig(90), scenario }).state;
      const players = [...state.home.players, ...state.away.players];
      const activeIds = [
        ...scenario.attackingPlayerIds,
        ...scenario.defendingPlayerIds,
        ...(scenario.attackingGoalkeeperId ? [scenario.attackingGoalkeeperId] : []),
        ...(scenario.defendingGoalkeeperId ? [scenario.defendingGoalkeeperId] : []),
      ];
      for (const playerId of activeIds) {
        const player = players.find(candidate => String(candidate.player.id) === playerId);
        expect(player).toBeDefined();
        if (scenario.goalkeeperMode !== "FROZEN" || playerId !== scenario.defendingGoalkeeperId) {
          expect(player!.disabled).not.toBe(true);
        }
      }
      expect(state.ball.owner?.player.id).toBe(scenario.primaryBallCarrierId);
      expect(state.ball.position.distanceTo(state.ball.owner!.position)).toBeLessThan(0.01);
    },
  );

  it("places a physical passing drill and freezes only isolated players", () => {
    const scenario = createCurriculumScenarioPreset("PASS");
    const state = new MatchInitializer().initialize({ ...buildSimulationConfig(44), scenario }).state;
    const passer = state.home.players.find(player => player.player.id === "home-10")!;
    const receiver = state.home.players.find(player => player.player.id === "home-9")!;
    const isolated = state.home.players.find(player => player.player.id === "home-2")!;
    expect(state.ball.owner).toBe(passer);
    expect(passer.scenarioDecisionDisabled).toBe(false);
    expect(receiver.scenarioDecisionDisabled).toBe(false);
    expect(receiver.position.x).toBeGreaterThan(passer.position.x);
    expect(isolated.scenarioDecisionDisabled).toBe(true);
    expect(isolated.scenarioMovementFrozen).toBe(true);
    expect(state.kickoff).toBeNull();
  });

  it("makes the learned goalkeeper active while the early drill goalkeeper is frozen", () => {
    const frozen = new MatchInitializer().initialize({
      ...buildSimulationConfig(1), scenario: createCurriculumScenarioPreset("TWO_V_ONE"),
    }).state.away.players.find(player => player.player.id === "away-1")!;
    const learned = new MatchInitializer().initialize({
      ...buildSimulationConfig(1), scenario: createCurriculumScenarioPreset("LEARNED_GOALKEEPER"),
    }).state.away.players.find(player => player.player.id === "away-1")!;
    expect(frozen.scenarioMovementFrozen).toBe(true);
    expect(frozen.scenarioDecisionDisabled).toBe(true);
    expect(learned.scenarioMovementFrozen).toBe(false);
    expect(learned.scenarioDecisionDisabled).toBe(false);
  });

  it("applies independent tactical parameters in reduced football", () => {
    const scenario = createCurriculumScenarioPreset("SEVEN_V_SEVEN");
    const state = new MatchInitializer().initialize({ ...buildSimulationConfig(71), scenario }).state;
    expect(state.home.tactic.inPossession).toMatchObject({ tempo: "HIGH", width: "WIDE", passingStyle: "DIRECT" });
    expect(state.home.tactic.transition).toMatchObject({ counterAttack: true, regroup: true, counterPress: false });
    expect(state.away.tactic.outOfPossession).toMatchObject({ defensiveLine: "STANDARD", pressLine: "MID", intensity: "NORMAL" });
    expect([...state.home.players, ...state.away.players]
      .filter(player => !player.scenarioDecisionDisabled)).toHaveLength(14);
  });
});

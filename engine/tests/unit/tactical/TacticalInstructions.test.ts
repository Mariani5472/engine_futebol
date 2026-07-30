import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { applyTacticalInstructionDecisionModifier } from "../../../src/application/match/decision/TacticalInstructionDecisionModifier";
import { MatchInitializer } from "../../../src/application/match/engine/MatchInitializer";
import { TacticalEngine } from "../../../src/application/match/tactical/TacticalEngine";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { Tactic, type TacticProps } from "../../../src/domain";
import { buildMinimalMatchState, buildSimulationConfig, buildTactic } from "../../helpers/builders";

function tactic(overrides: Partial<TacticProps>): Tactic {
  const base = buildTactic();
  return Tactic.create({
    defensiveShape: base.defensiveShape,
    attackingShape: base.attackingShape,
    teamInstructions: base.teamInstructions,
    playerInstructions: base.playerInstructions,
    familiarity: base.familiarity,
    ...overrides,
  });
}

describe("grouped tactical instructions", () => {
  it("wide and narrow possession instructions produce different maps", () => {
    const config = buildSimulationConfig(17);
    const wide = new MatchInitializer().initialize({ ...config, homeTactic: tactic({ inPossession: { width: "WIDE" } }) }).state;
    const narrow = new MatchInitializer().initialize({ ...config, homeTactic: tactic({ inPossession: { width: "NARROW" } }) }).state;
    wide.home.collectivePhase = narrow.home.collectivePhase = "PROGRESSION";
    wide.ball.position = narrow.ball.position = new Vector2(55, 34);
    new TacticalEngine().update(wide);
    new TacticalEngine().update(narrow);

    const widePlayer = wide.home.players.find(player => player.currentRole === "WIDE_MIDFIELDER")!;
    const narrowPlayer = narrow.home.players.find(player => player.currentRole === "WIDE_MIDFIELDER")!;
    expect(Math.abs(widePlayer.targetPosition.y - 34)).toBeGreaterThan(Math.abs(narrowPlayer.targetPosition.y - 34) + 5);
  });

  it("high and low defensive lines move defenders to different heights", () => {
    const config = buildSimulationConfig(18);
    const high = new MatchInitializer().initialize({ ...config, homeTactic: tactic({ outOfPossession: { defensiveLine: "HIGH" } }) }).state;
    const low = new MatchInitializer().initialize({ ...config, homeTactic: tactic({ outOfPossession: { defensiveLine: "LOW" } }) }).state;
    high.home.collectivePhase = low.home.collectivePhase = "DEFENSIVE_BLOCK";
    new TacticalEngine().update(high);
    new TacticalEngine().update(low);

    const highCb = high.home.players.find(player => player.currentRole === "CENTRE_BACK")!;
    const lowCb = low.home.players.find(player => player.currentRole === "CENTRE_BACK")!;
    expect(highCb.targetPosition.x).toBeGreaterThan(lowCb.targetPosition.x + 8);
  });

  it("modifies utility without starting the instructed action", () => {
    const state = buildMinimalMatchState();
    (state.home as any).tactic = tactic({ inPossession: { tempo: "HIGH", workBallIntoBox: true } });
    const player = state.home.players[0];
    const awareness = PlayerAwareness.create(player.player.id);
    const world = new WorldAwarenessSystem().build(state, player, awareness);
    const context = new DecisionContext(state, player, awareness, 0, .05, world);
    const original = new Decision(DecisionType.SHOT, 40);

    const modified = applyTacticalInstructionDecisionModifier(original, context);

    expect(modified.utility).toBeLessThan(original.utility);
    expect(player.activeAction).toBeUndefined();
  });

  it("raises pressure utility against a specifically targeted opponent", () => {
    const state = buildMinimalMatchState();
    const defender = state.home.players[1];
    defender.hasBall = false;
    const opponent = state.away.players[0];
    (state.home as any).tactic = tactic({ opposition: { players: [{
      opponentPlayerId: opponent.player.id, press: true, tightMark: true,
      forceWeakFoot: true, doubleMark: false,
    }] } });
    const awareness = PlayerAwareness.create(defender.player.id);
    const world = new WorldAwarenessSystem().build(state, defender, awareness);
    const context = new DecisionContext(state, defender, awareness, 0, .05, world);
    const original = new Decision(DecisionType.PRESS, 20, opponent.player.id);

    expect(applyTacticalInstructionDecisionModifier(original, context).utility).toBeGreaterThan(20);
    expect(defender.activeAction).toBeUndefined();
  });
});

import { PlayerAwareness } from "../../../src/application/match/awareness/memory/PlayerAwareness";
import { WorldAwarenessSystem } from "../../../src/application/match/awareness/WorldAwarenessSystem";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionContext } from "../../../src/application/match/decision/DecisionContext";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { ExpectedValueModel } from "../../../src/application/match/decision/ExpectedValueModel";
import { Vector2 } from "../../../src/core/geometry/Vector2";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("ExpectedValueModel", () => {
  it("exposes goal, future-possession and defensive-exposure components", () => {
    const state = buildMinimalMatchState();
    const player = state.home.players[0];
    player.hasBall = true;
    player.position = new Vector2(90, 34);
    state.ball.owner = player;
    state.ball.position = player.position;
    const awareness = PlayerAwareness.create(player.player.id);
    const world = new WorldAwarenessSystem().build(state, player, awareness);
    const context = new DecisionContext(state, player, awareness, 0, .05, world);
    const applied = new ExpectedValueModel().apply(new Decision(DecisionType.SHOT, 40), context);

    expect(applied.components?.GOAL_PROBABILITY).toBeGreaterThan(0);
    expect(applied.components).toHaveProperty("FUTURE_POSSESSION_VALUE");
    expect(applied.components).toHaveProperty("DEFENSIVE_EXPOSURE");
    expect(applied.reasons?.some(reason => reason.code === "EXPECTED_VALUE")).toBe(true);
  });

  it("raises attacking value when trailing late without changing action physics",()=>{
    const state=buildMinimalMatchState(); const player=state.home.players[0];
    player.position=new Vector2(90,34);player.hasBall=true;state.ball.owner=player;state.ball.position=player.position;
    const awareness=PlayerAwareness.create(player.player.id);
    const build=()=>new DecisionContext(state,player,awareness,0,.05,new WorldAwarenessSystem().build(state,player,awareness));
    const model=new ExpectedValueModel();
    const level=model.evaluate(new Decision(DecisionType.SHOT,40),build()).utilityModifier;
    (state.away as {score:number}).score=2; state.currentSecond=82*60;
    const chasing=model.evaluate(new Decision(DecisionType.SHOT,40),build()).utilityModifier;
    expect(chasing).toBeGreaterThan(level);
  });
});

import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { ActionExecutionPhase } from "../../../src/application/match/action/ActionExecution";
import { ActionReadiness } from "../../../src/application/match/decision/evaluators/ActionReadiness";
import { PlayerMatchState } from "../../../src/core/movement/PlayerMatchState";
import { Vector2 } from "../../../src/core/geometry/Vector2";

function createPlayer(id: string, position: Vector2): PlayerMatchState {
  return new PlayerMatchState(
    { id } as never,
    position,
    new Vector2(0, 0),
    100,
    0,
    false,
    "MIDFIELDER" as never,
    position,
    new Vector2(1, 0),
    0,
    0,
    "STANDING",
    0,
    100,
    100,
  );
}

describe("ActionReadiness interaction signals", () => {
  it("increases pressure as a defender approaches the ball carrier", () => {
    const owner = createPlayer("owner", new Vector2(0, 0));
    const farDefender = createPlayer("far", new Vector2(8, 0));
    const closeDefender = createPlayer("close", new Vector2(2, 0));

    const farPressure = ActionReadiness.opponentPressure(owner, [farDefender]);
    const closePressure = ActionReadiness.opponentPressure(owner, [closeDefender]);

    expect(closePressure).toBeGreaterThan(farPressure);
  });

  it("recognizes a preparation window as an interruption opportunity", () => {
    const owner = createPlayer("owner", new Vector2(0, 0));
    const defender = createPlayer("defender", new Vector2(2, 0));

    owner.activeAction = {
      type: DecisionType.PASS,
      phase: ActionExecutionPhase.PREPARING,
      startedAt: 0,
      executeAt: 0.5,
    } as never;

    const opportunity = ActionReadiness.interruptionOpportunity(
      owner,
      defender,
      0.1,
    );

    expect(opportunity).toBeGreaterThan(0);
  });

  it("does not expose an interruption opportunity after preparation completes", () => {
    const owner = createPlayer("owner", new Vector2(0, 0));
    const defender = createPlayer("defender", new Vector2(2, 0));

    owner.activeAction = {
      type: DecisionType.PASS,
      phase: ActionExecutionPhase.EXECUTING,
      startedAt: 0,
      executeAt: 0.5,
    } as never;

    const opportunity = ActionReadiness.interruptionOpportunity(
      owner,
      defender,
      0.1,
    );

    expect(opportunity).toBe(0);
  });

  it("prioritizes an already-started tackle as immediate pressure", () => {
    const owner = createPlayer("owner", new Vector2(0, 0));
    const defender = createPlayer("defender", new Vector2(2, 0));

    defender.activeAction = {
      type: DecisionType.TACKLE,
      phase: ActionExecutionPhase.PREPARING,
    } as never;

    const pressure = ActionReadiness.opponentPressure(owner, [defender]);

    expect(pressure).toBeGreaterThanOrEqual(0.75);
  });

  it("does not let an interruptible RECEIVE bypass first-touch stabilization", () => {
    const owner = createPlayer("owner", new Vector2(0, 0));
    owner.possessionControlUntil = 1;
    owner.lastActionType = DecisionType.RECEIVE;
    const context = { player: owner, currentTick: 10, deltaTime: .05 } as never;
    expect(ActionReadiness.canStartAction(context)).toBe(false);
    const settled = { player: owner, currentTick: 25, deltaTime: .05 } as never;
    expect(ActionReadiness.canStartAction(settled)).toBe(true);
  });
});

import {
  ActionExecution,
  ActionExecutionPhase,
} from "../../../src/application/match/action/ActionExecution";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { MovementSystem } from "../../../src/core/movement/MovementSystem";
import { PlayerMatchState } from "../../../src/core/movement/PlayerMatchState";
import { Vector2 } from "../../../src/core/geometry/Vector2";

function createPlayer(id: string): PlayerMatchState {
  const attributes = {
    mental: {
      aggression: 10,
      bravery: 10,
      decisions: 10,
      composure: 10,
      concentration: 10,
      anticipation: 10,
      workRate: 10,
    },
    physical: {
      pace: 15,
      agility: 10,
      balance: 10,
      stamina: 10,
      strength: 10,
      acceleration: 10,
      naturalFitness: 10,
    },
    technical: {
      passing: 10,
      technique: 10,
      firstTouch: 10,
      crossing: 10,
      finishing: 10,
      dribbling: 10,
      tackling: 10,
      heading: 10,
      kicking: 10,
    },
    goalkeeping: {
      aerialReach: 10,
      handling: 10,
      rushingOut: 10,
      throwing: 10,
    },
  };

  return new PlayerMatchState(
    {
      id,
      attributes,
    } as never,
    new Vector2(0, 0),
    new Vector2(0, 0),
    100,
    0,
    false,
    "MIDFIELDER" as never,
    new Vector2(10, 0),
    new Vector2(1, 0),
    0,
    0,
    "STANDING",
    0,
    100,
    100,
  );
}

function createState(player: PlayerMatchState): unknown {
  return {
    home: { players: [player] },
    away: { players: [] },
  };
}

describe("MovementSystem + ActionExecution physical state", () => {
  it("completely blocks movement while the player is FALLING", () => {
    const player = createPlayer("player-1");
    const movement = new MovementSystem();

    player.bodyState = "FALLING";

    movement.update(createState(player) as never, 0.5);

    expect(player.position.x).toBe(0);
    expect(player.position.y).toBe(0);
    expect(player.velocity.magnitude()).toBe(0);
  });

  it("completely blocks movement while the player is on the GROUND", () => {
    const player = createPlayer("player-1");
    const movement = new MovementSystem();

    player.bodyState = "GROUND";

    movement.update(createState(player) as never, 0.5);

    expect(player.position.x).toBe(0);
    expect(player.velocity.magnitude()).toBe(0);
  });

  it("limits movement while an action is recovering", () => {
    const player = createPlayer("player-1");
    const execution = ActionExecution.start(
      new Decision(DecisionType.PASS, 1),
      player,
      0,
    );

    expect(execution).toBeDefined();

    player.activeAction = execution;
    execution!.advance(execution!.executeAt);
    execution!.markResolved(execution!.executeAt);

    expect(execution!.phase).toBe(ActionExecutionPhase.RECOVERING);

    const movement = new MovementSystem();
    movement.update(createState(player) as never, 0.5);

    const recoveringDistance = player.position.magnitude();

    expect(recoveringDistance).toBeGreaterThan(0);
    expect(recoveringDistance).toBeLessThan(15 * 0.5 * 0.9);
  });

  it("restores normal movement after a falling action completes recovery", () => {
    const player = createPlayer("player-1");
    const execution = ActionExecution.start(
      new Decision(DecisionType.TACKLE, 1),
      player,
      0,
    );

    expect(execution).toBeDefined();
    player.activeAction = execution;

    execution!.advance(execution!.executeAt);
    execution!.markResolved(execution!.executeAt);

    expect(execution!.phase).toBe(ActionExecutionPhase.RECOVERING);
    expect(player.bodyState).toBe("FALLING");

    const movement = new MovementSystem();
    movement.update(createState(player) as never, 0.5);

    expect(player.position.x).toBe(0);

    execution!.advance(execution!.recoveryUntil);

    expect(execution!.phase).toBe(ActionExecutionPhase.COMPLETED);
    expect(player.bodyState).toBe("STANDING");

    movement.update(createState(player) as never, 0.5);

    expect(player.position.x).toBeGreaterThan(0);
  });
});

describe("ActionExecution interruption during PREPARING", () => {
  it("prevents the prepared pass from ever reaching execution", () => {
    const player = createPlayer("ball-owner");
    player.hasBall = true;

    const execution = ActionExecution.start(
      new Decision(DecisionType.PASS, 1),
      player,
      0,
    );

    expect(execution).toBeDefined();
    expect(execution!.phase).toBe(ActionExecutionPhase.PREPARING);

    const interrupted = execution!.interrupt("TACKLE", 0.05);

    expect(interrupted).toBe(true);
    expect(execution!.phase).toBe(ActionExecutionPhase.RECOVERING);
    expect(execution!.interruptionReason).toBe("TACKLE");
    expect(player.bodyState).toBe("FALLING");

    execution!.advance(execution!.executeAt);

    expect(execution!.phase).toBe(ActionExecutionPhase.RECOVERING);
  });
});

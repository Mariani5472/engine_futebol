import { ActionExecution, ActionExecutionPhase } from "../../../src/application/match/action/ActionExecution";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { PlayerMatchState } from "../../../src/core/movement/PlayerMatchState";
import { PlayerAttributes } from "../../../src/domain/player";
import { Vector2 } from "../../../src/core/geometry/Vector2";

function createAttributes(value: number): PlayerAttributes {
  return {
    mental: {
      decisions: value,
      composure: value,
      concentration: value,
      anticipation: value,
      workRate: value,
    },
    physical: {
      agility: value,
      balance: value,
      stamina: value,
      strength: value,
      acceleration: value,
      naturalFitness: value,
    },
    technical: {
      passing: value,
      technique: value,
      firstTouch: value,
      crossing: value,
      finishing: value,
      dribbling: value,
      tackling: value,
      heading: value,
      kicking: value,
    },
    goalkeeping: {
      aerialReach: value,
      handling: value,
      rushingOut: value,
      throwing: value,
    },
  } as unknown as PlayerAttributes;
}

function createPlayer(attributes: PlayerAttributes): PlayerMatchState {
  const player = {
    id: "player-1",
    attributes,
  };

  return new PlayerMatchState(
    player as never,
    new Vector2(0, 0),
    new Vector2(0, 0),
    100,
    0,
    true,
    "MIDFIELDER" as never,
    new Vector2(0, 0),
    new Vector2(1, 0),
    0,
    0,
    "STANDING",
    0,
    100,
    100,
  );
}

function createPassDecision(): Decision {
  return new Decision(DecisionType.PASS, 1);
}

describe("ActionExecution — lifecycle", () => {
  it("starts in PREPARING", () => {
    const player = createPlayer(createAttributes(10));
    const execution = ActionExecution.start(
      createPassDecision(),
      player,
      100,
    );

    expect(execution).toBeDefined();
    expect(execution?.phase).toBe(ActionExecutionPhase.PREPARING);
    expect(player.activeAction).toBeUndefined();
    expect(player.lastActionType).toBe(DecisionType.PASS);
  });

  it("does not reach EXECUTING before executeAt", () => {
    const player = createPlayer(createAttributes(10));
    const execution = ActionExecution.start(
      createPassDecision(),
      player,
      100,
    );

    expect(execution).toBeDefined();

    const beforeExecution = execution!.executeAt - 0.0001;
    expect(execution!.advance(beforeExecution)).toBe(
      ActionExecutionPhase.PREPARING,
    );
  });

  it("reaches EXECUTING exactly at executeAt", () => {
    const player = createPlayer(createAttributes(10));
    const execution = ActionExecution.start(
      createPassDecision(),
      player,
      100,
    );

    expect(execution!.advance(execution!.executeAt)).toBe(
      ActionExecutionPhase.EXECUTING,
    );
  });

  it("enters RECOVERING after the execution phase", () => {
    const player = createPlayer(createAttributes(10));
    const execution = ActionExecution.start(
      createPassDecision(),
      player,
      100,
    );

    execution!.advance(execution!.executeAt);

    expect(execution!.markResolved(execution!.executeAt)).toBe(
      ActionExecutionPhase.RECOVERING,
    );
  });

  it("keeps the player busy during recovery", () => {
    const player = createPlayer(createAttributes(10));
    const execution = ActionExecution.start(
      createPassDecision(),
      player,
      100,
    );

    execution!.advance(execution!.executeAt);
    execution!.markResolved(execution!.executeAt);

    expect(execution!.phase).toBe(ActionExecutionPhase.RECOVERING);
    expect(execution!.isBusy()).toBe(true);
    expect(execution!.phase).not.toBe(ActionExecutionPhase.IDLE);
    expect(execution!.phase).not.toBe(ActionExecutionPhase.COMPLETED);
  });

  it("finishes in COMPLETED after recovery", () => {
    const player = createPlayer(createAttributes(10));
    const execution = ActionExecution.start(
      createPassDecision(),
      player,
      100,
    );

    execution!.advance(execution!.executeAt);
    execution!.markResolved(execution!.executeAt);

    expect(execution!.advance(execution!.recoveryUntil)).toBe(
      ActionExecutionPhase.COMPLETED,
    );
    expect(execution!.isBusy()).toBe(false);
  });
});

describe("ActionExecution — attribute-dependent timing", () => {
  it("gives higher-attribute players shorter action timings", () => {
    const lowAttributePlayer = createPlayer(createAttributes(5));
    const highAttributePlayer = createPlayer(createAttributes(18));
    const decision = createPassDecision();

    const lowExecution = ActionExecution.start(
      decision,
      lowAttributePlayer,
      0,
    );
    const highExecution = ActionExecution.start(
      decision,
      highAttributePlayer,
      0,
    );

    expect(lowExecution).toBeDefined();
    expect(highExecution).toBeDefined();

    expect(highExecution!.timing.windupSeconds).toBeLessThan(
      lowExecution!.timing.windupSeconds,
    );
    expect(highExecution!.timing.recoverySeconds).toBeLessThan(
      lowExecution!.timing.recoverySeconds,
    );

    expect(highExecution!.executeAt).toBeLessThan(
      lowExecution!.executeAt,
    );
    expect(highExecution!.recoveryUntil).toBeLessThan(
      lowExecution!.recoveryUntil,
    );
  });

  it("makes the better player available for a new action sooner", () => {
    const lowAttributePlayer = createPlayer(createAttributes(5));
    const highAttributePlayer = createPlayer(createAttributes(18));

    const lowExecution = ActionExecution.start(
      createPassDecision(),
      lowAttributePlayer,
      0,
    );
    const highExecution = ActionExecution.start(
      createPassDecision(),
      highAttributePlayer,
      0,
    );

    expect(highExecution!.recoveryUntil).toBeLessThan(
      lowExecution!.recoveryUntil,
    );

    const timeAfterHighRecovery = highExecution!.recoveryUntil;

    highExecution!.advance(highExecution!.executeAt);
    highExecution!.markResolved(highExecution!.executeAt);
    highExecution!.advance(highExecution!.recoveryUntil);

    expect(highExecution!.phase).toBe(ActionExecutionPhase.COMPLETED);
    expect(timeAfterHighRecovery).toBeLessThan(
      lowExecution!.recoveryUntil,
    );
  });
});

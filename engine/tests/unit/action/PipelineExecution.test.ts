import { ActionExecutionPhase } from "../../../src/application/match/action/ActionExecution";
import {
  PipelineExecution,
  PipelinePhase,
} from "../../../src/application/match/action/PipelineExecution";
import { PipelineBuilder } from "../../../src/application/match/action/PipelineBuilder";
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
      aggression: value,
      bravery: value,
      vision: value,
      positioning: value,
    },
    physical: {
      agility: value,
      balance: value,
      stamina: value,
      strength: value,
      acceleration: value,
      naturalFitness: value,
      jumpingReach: value,
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
      reflexes: value,
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

describe("PipelineExecution — multi-step lifecycle", () => {
  it("starts ACTIVE with the first step in PREPARING", () => {
    const player = createPlayer(createAttributes(10));
    const steps = [
      new Decision(DecisionType.RECEIVE, 50),
      new Decision(DecisionType.CONTROL, 45),
    ];

    const pipeline = PipelineExecution.start(steps, player, 100);

    expect(pipeline).toBeDefined();
    expect(pipeline!.phase).toBe(PipelinePhase.ACTIVE);
    expect(pipeline!.currentIndex).toBe(0);
    expect(pipeline!.currentType).toBe(DecisionType.RECEIVE);
    expect(pipeline!.currentAction?.phase).toBe(ActionExecutionPhase.PREPARING);
    expect(player.activePipeline).toBe(pipeline);
    expect(player.activeAction).toBe(pipeline!.currentAction);
    expect(pipeline!.isBusy()).toBe(true);
  });

  it("reports justReachedExecuting when first step hits executeAt", () => {
    const player = createPlayer(createAttributes(10));
    const pipeline = PipelineExecution.start(
      [new Decision(DecisionType.PASS, 40)],
      player,
      100,
    )!;

    const executeAt = pipeline.currentAction!.executeAt;
    const result = pipeline.advance(executeAt);

    expect(result.justReachedExecuting).toBeDefined();
    expect(result.justReachedExecuting!.phase).toBe(
      ActionExecutionPhase.EXECUTING,
    );
  });

  it("advances to the next step after current step completes recovery", () => {
    const player = createPlayer(createAttributes(10));
    const pipeline = PipelineExecution.start(
      [
        new Decision(DecisionType.RECEIVE, 50),
        new Decision(DecisionType.CONTROL, 45),
      ],
      player,
      0,
    )!;

    const first = pipeline.currentAction!;

    // PREPARING → EXECUTING
    pipeline.advance(first.executeAt);
    // EXECUTING → RECOVERING (simulate resolve)
    pipeline.markStepResolved(first.executeAt);
    expect(first.phase).toBe(ActionExecutionPhase.RECOVERING);

    // RECOVERING → COMPLETED → start CONTROL
    const result = pipeline.advance(first.recoveryUntil);

    expect(result.steppedForward).toBe(true);
    expect(pipeline.currentIndex).toBe(1);
    expect(pipeline.currentType).toBe(DecisionType.CONTROL);
    expect(pipeline.phase).toBe(PipelinePhase.ACTIVE);
    expect(pipeline.currentAction?.phase).toBe(ActionExecutionPhase.PREPARING);
    expect(player.activeAction).toBe(pipeline.currentAction);
  });

  it("completes when the last step finishes recovery", () => {
    const player = createPlayer(createAttributes(10));
    const pipeline = PipelineExecution.start(
      [new Decision(DecisionType.PASS, 40)],
      player,
      0,
    )!;

    const action = pipeline.currentAction!;
    pipeline.advance(action.executeAt);
    pipeline.markStepResolved(action.executeAt);
    pipeline.advance(action.recoveryUntil);

    expect(pipeline.phase).toBe(PipelinePhase.COMPLETED);
    expect(pipeline.isBusy()).toBe(false);
    expect(player.activePipeline).toBeUndefined();
  });

  it("interrupt cancels remaining steps", () => {
    const player = createPlayer(createAttributes(10));
    const pipeline = PipelineExecution.start(
      [
        new Decision(DecisionType.RECEIVE, 50),
        new Decision(DecisionType.CONTROL, 45),
        new Decision(DecisionType.SHOT, 60),
      ],
      player,
      0,
    )!;

    const interrupted = pipeline.interrupt("TACKLE", 0.5);

    expect(interrupted).toBe(true);
    expect(pipeline.phase).toBe(PipelinePhase.INTERRUPTED);
    expect(pipeline.interruptionReason).toBe("TACKLE");
    expect(pipeline.currentIndex).toBe(0);
    // Remaining steps are never started.
    expect(pipeline.remainingSteps.length).toBe(3);
  });
});

describe("PipelineBuilder — natural expansions", () => {
  const builder = new PipelineBuilder();

  it("expands RECEIVE into RECEIVE → CONTROL", () => {
    const player = createPlayer(createAttributes(10));
    const steps = builder.build(
      new Decision(DecisionType.RECEIVE, 55),
      player,
    );

    expect(steps.map((s) => s.type)).toEqual([
      DecisionType.RECEIVE,
      DecisionType.CONTROL,
    ]);
  });

  it("prepends CONTROL before SHOT after a RECEIVE", () => {
    const player = createPlayer(createAttributes(10));
    player.lastActionType = DecisionType.RECEIVE;

    const steps = builder.build(
      new Decision(DecisionType.SHOT, 70),
      player,
    );

    expect(steps.map((s) => s.type)).toEqual([
      DecisionType.CONTROL,
      DecisionType.SHOT,
    ]);
  });

  it("keeps SHOT as single step when ball is already controlled", () => {
    const player = createPlayer(createAttributes(10));
    player.lastActionType = DecisionType.CONTROL;

    const steps = builder.build(
      new Decision(DecisionType.SHOT, 70),
      player,
    );

    expect(steps.map((s) => s.type)).toEqual([DecisionType.SHOT]);
  });

  it("chains SKILL_MOVE after DRIBBLE for high-skill players", () => {
    const player = createPlayer(createAttributes(16));
    const steps = builder.build(
      new Decision(DecisionType.DRIBBLE, 50),
      player,
    );

    expect(steps.map((s) => s.type)).toEqual([
      DecisionType.DRIBBLE,
      DecisionType.SKILL_MOVE,
    ]);
  });

  it("does not chain SKILL_MOVE for low-skill players", () => {
    const player = createPlayer(createAttributes(6));
    const steps = builder.build(
      new Decision(DecisionType.DRIBBLE, 40),
      player,
    );

    expect(steps.map((s) => s.type)).toEqual([DecisionType.DRIBBLE]);
  });

  it("prepends CONTROL before PASS after RECEIVE", () => {
    const player = createPlayer(createAttributes(10));
    player.lastActionType = DecisionType.RECEIVE;

    const steps = builder.build(
      new Decision(DecisionType.PASS, 48, "teammate-2"),
      player,
    );

    expect(steps.map((s) => s.type)).toEqual([
      DecisionType.CONTROL,
      DecisionType.PASS,
    ]);
    expect(steps[1].targetId).toBe("teammate-2");
  });
});

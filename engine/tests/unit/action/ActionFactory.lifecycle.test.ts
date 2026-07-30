import { ActionFactory } from "../../../src/application/match/action/ActionFactory";
import { ActionExecutionPhase } from "../../../src/application/match/action/ActionExecution";
import { PassAction } from "../../../src/application/match/action/actions/PassAction";
import { ActionContext } from "../../../src/application/match/action/ActionContext";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { RefereeSystem } from "../../../src/application/match/referee/RefereeSystem";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("ActionFactory + ActionExecution — lifecycle integration", () => {
  function createContext(
    matchSecond: number,
  ): {
    context: ActionContext;
    passDecision: Decision;
  } {
    const match = buildMinimalMatchState();
    const player = match.home.players[0];

    const passDecision = new Decision(
      DecisionType.PASS,
      1,
      "missing-target",
    );

    const context: ActionContext = {
      player,
      decision: passDecision,
      match,
      pitch: match.pitch,
      random: new SeededRandom(42),
      tick: 0,
      deltaTime: 0.1,
      teamSide: "HOME",
      attackingDirection: 1,
      matchSecond,
    };

    return { context, passDecision };
  }

  it("executes the concrete action only when the lifecycle reaches EXECUTING", () => {
    const { context, passDecision } = createContext(0);
    const factory = new ActionFactory(
      new RefereeSystem(new SeededRandom(42)),
    );
    const passExecuteSpy = jest.spyOn(PassAction.prototype, "execute");

    try {
      const startResult = factory.execute(passDecision, context);
      const execution = context.player.activeAction;

      expect(startResult.type).toBe(DecisionType.PASS);
      expect(execution?.phase).toBe(ActionExecutionPhase.PREPARING);
      expect(passExecuteSpy).not.toHaveBeenCalled();

      const beforeExecuteContext = {
        ...context,
        matchSecond: execution!.executeAt - 0.0001,
      };

      factory.execute(passDecision, beforeExecuteContext);

      expect(execution!.phase).toBe(ActionExecutionPhase.PREPARING);
      expect(passExecuteSpy).not.toHaveBeenCalled();

      const executeContext = {
        ...context,
        matchSecond: execution!.executeAt,
      };

      factory.execute(passDecision, executeContext);

      expect(passExecuteSpy).toHaveBeenCalledTimes(1);
      expect(execution!.phase).toBe(ActionExecutionPhase.RECOVERING);
    } finally {
      passExecuteSpy.mockRestore();
    }
  });

  it("does not accept a new decision while the current action is recovering", () => {
    const { context, passDecision } = createContext(0);
    const factory = new ActionFactory(
      new RefereeSystem(new SeededRandom(42)),
    );
    const passExecuteSpy = jest.spyOn(PassAction.prototype, "execute");

    try {
      factory.execute(passDecision, context);
      const execution = context.player.activeAction!;

      factory.execute(passDecision, {
        ...context,
        matchSecond: execution.executeAt,
      });

      expect(execution.phase).toBe(ActionExecutionPhase.RECOVERING);
      expect(passExecuteSpy).toHaveBeenCalledTimes(1);

      const newDecision = new Decision(DecisionType.SHOT, 100);
      const recoveryContext = {
        ...context,
        decision: newDecision,
        matchSecond:
          execution.executeAt + execution.timing.recoverySeconds / 2,
      };

      const result = factory.execute(newDecision, recoveryContext);

      expect(result.type).toBe(DecisionType.PASS);
      expect(context.player.activeAction).toBe(execution);
      expect(execution.phase).toBe(ActionExecutionPhase.RECOVERING);
      expect(passExecuteSpy).toHaveBeenCalledTimes(1);
    } finally {
      passExecuteSpy.mockRestore();
    }
  });

  it("allows a new action only after the previous execution is completed", () => {
    const { context, passDecision } = createContext(0);
    const factory = new ActionFactory(
      new RefereeSystem(new SeededRandom(42)),
    );
    const passExecuteSpy = jest.spyOn(PassAction.prototype, "execute");

    try {
      factory.execute(passDecision, context);
      const execution = context.player.activeAction!;

      factory.execute(passDecision, {
        ...context,
        matchSecond: execution.executeAt,
      });

      expect(execution.phase).toBe(ActionExecutionPhase.RECOVERING);
      expect(passExecuteSpy).toHaveBeenCalledTimes(1);

      factory.execute(passDecision, {
        ...context,
        matchSecond: execution.recoveryUntil,
      });

      expect(execution.phase).toBe(ActionExecutionPhase.COMPLETED);
      expect(context.player.activeAction).toBeUndefined();
      expect(passExecuteSpy).toHaveBeenCalledTimes(1);

      const secondStartResult = factory.execute(passDecision, {
        ...context,
        matchSecond: execution.recoveryUntil,
      });

      expect(secondStartResult.type).toBe(DecisionType.PASS);
      expect(context.player.activeAction).toBeDefined();
      expect(context.player.activeAction).not.toBe(execution);
      expect(context.player.activeAction?.phase).toBe(
        ActionExecutionPhase.PREPARING,
      );
      expect(passExecuteSpy).toHaveBeenCalledTimes(1);
    } finally {
      passExecuteSpy.mockRestore();
    }
  });

  it("assigns a unique deterministic identity to every accepted action", () => {
    const { context, passDecision } = createContext(0);
    const factory = new ActionFactory(new RefereeSystem(new SeededRandom(42)));

    factory.execute(passDecision, context);
    const first = context.player.activeAction!;
    factory.execute(passDecision, { ...context, matchSecond: first.executeAt });
    factory.execute(passDecision, { ...context, matchSecond: first.recoveryUntil });
    factory.execute(passDecision, { ...context, matchSecond: first.recoveryUntil });
    const second = context.player.activeAction!;

    expect(first.actionId).toMatch(/^action:00000001:/);
    expect(second.actionId).toMatch(/^action:00000002:/);
    expect(second.actionId).not.toBe(first.actionId);
  });
});

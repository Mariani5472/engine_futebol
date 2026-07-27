import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { ActionContext } from "./ActionContext";
import { ActionResult } from "./ActionResult";
import { ClearanceAction } from "./actions/ClearanceAction";
import { DribbleAction } from "./actions/DribbleAction";
import { HeaderAction } from "./actions/HeaderAction";
import { HoldBallAction } from "./actions/HoldBallAction";
import { PassAction } from "./actions/PassAction";
import { ShotAction } from "./actions/ShotAction";
import { TackleAction } from "./actions/TackleAction";
import { RefereeSystem } from "../referee/RefereeSystem";
import { ActionExecution, ActionExecutionPhase } from "./ActionExecution";
import { getActionExecutionProfile } from "./ActionExecutionProfile";

/**
 * Creates and advances physical action executions.
 *
 * Contract (Phase 1):
 * - Evaluators only produce Decision.
 * - Every discrete action is born as an ActionExecution.
 * - MatchState is mutated ONLY when an execution reaches EXECUTING.
 * - Nothing executes instantaneously.
 */
export class ActionFactory {
  private readonly pass = new PassAction();
  private readonly shot = new ShotAction();
  private readonly dribble = new DribbleAction();
  private readonly header = new HeaderAction();
  private readonly clearance = new ClearanceAction();
  private readonly holdBall = new HoldBallAction();
  private readonly tackle: TackleAction;

  constructor(referee: RefereeSystem) {
    this.tackle = new TackleAction(referee);
  }

  /**
   * Start a new ActionExecution from a Decision.
   * Returns the execution if created (player is now busy).
   * Continuous / positional decisions (PRESS, MOVE, …) return undefined.
   */
  public tryStart(
    decision: Decision,
    player: import("../../../core/movement/PlayerMatchState").PlayerMatchState,
    currentTime: number,
  ): ActionExecution | undefined {
    if (player.isActionBusy()) return undefined;

    if (isContinuousAction(decision.type)) {
      return undefined;
    }

    const profile = getActionExecutionProfile(decision.type);
    if (!profile) return undefined;

    const execution = ActionExecution.start(decision, player, currentTime);
    if (execution) {
      player.activeAction = execution;
    }
    return execution;
  }

  /**
   * Advance an existing ActionExecution and, if it just reached EXECUTING,
   * resolve the football outcome (mutate MatchState).
   *
   * Call this ONLY for actions that the ActionArbitrator has approved.
   */
  public resolveExecuting(
    execution: ActionExecution,
    context: ActionContext,
  ): ActionResult {
    const result = this.executeAction(execution.decision, context);

    // Move into RECOVERING immediately after the physical outcome is applied.
    execution.advance(context.matchSecond);

    return result;
  }

  /**
   * Advance a single player's active action without applying outcome.
   * Used by the tick scheduler before arbitration.
   */
  public advanceOnly(
    player: import("../../../core/movement/PlayerMatchState").PlayerMatchState,
    currentTime: number,
  ): ActionExecutionPhase | undefined {
    if (!player.activeAction) return undefined;

    const phase = player.activeAction.advance(currentTime);

    if (phase === ActionExecutionPhase.COMPLETED) {
      player.activeAction = undefined;
    }

    return phase;
  }

  /**
   * @deprecated Prefer the scheduler flow: tryStart → advanceOnly → resolveExecuting.
   * Kept for backward-compatible unit tests that still call execute() directly.
   */
  public execute(
    decision: Decision,
    context: ActionContext,
  ): ActionResult {
    const player = context.player;

    if (player.activeAction) {
      const phase = player.activeAction.advance(context.matchSecond);

      if (phase === ActionExecutionPhase.EXECUTING) {
        const result = this.executeAction(
          player.activeAction.decision,
          context,
        );
        player.activeAction.advance(context.matchSecond);
        return result;
      }

      if (phase === ActionExecutionPhase.COMPLETED) {
        player.activeAction = undefined;
      }

      return this.noopResult(
        player.player.id,
        player.activeAction?.type ?? decision.type,
      );
    }

    // Start a new lifecycle — never execute immediately.
    const execution = this.tryStart(decision, player, context.matchSecond);
    if (execution) {
      return this.noopResult(player.player.id, decision.type);
    }

    if (isContinuousAction(decision.type)) {
      return {
        actorId: player.player.id,
        type: decision.type,
        success: true,
        events: [],
      };
    }

    return this.noopResult(player.player.id, decision.type);
  }

  private executeAction(
    decision: Decision,
    context: ActionContext,
  ): ActionResult {
    switch (decision.type) {
      case DecisionType.PASS:
      case DecisionType.CROSS:
      case DecisionType.GK_DISTRIBUTE:
        return this.pass.execute(context);

      case DecisionType.SHOT:
        return this.shot.execute(context);

      case DecisionType.DRIBBLE:
      case DecisionType.SKILL_MOVE:
      case DecisionType.FAKE:
        return this.dribble.execute(context);

      case DecisionType.HEADER:
        return this.header.execute(context);

      case DecisionType.TACKLE:
      case DecisionType.INTERCEPT:
      case DecisionType.BLOCK:
      case DecisionType.TACTICAL_FOUL:
        return this.tackle.execute(context);

      case DecisionType.CLEAR:
      case DecisionType.GK_CLAIM:
        return this.clearance.execute(context);

      case DecisionType.HOLD_BALL:
      case DecisionType.CONTROL:
      case DecisionType.RECEIVE:
      case DecisionType.SET_PIECE:
        return this.holdBall.execute(context);

      case DecisionType.PRESS:
      case DecisionType.MARK:
      case DecisionType.COVER:
      case DecisionType.MOVE:
      case DecisionType.POSITION:
        return {
          actorId: context.player.player.id,
          type: decision.type,
          success: true,
          events: [],
        };

      case DecisionType.NONE:
        return {
          actorId: context.player.player.id,
          type: DecisionType.NONE,
          success: true,
          events: [],
        };

      default:
        return {
          actorId: context.player.player.id,
          type: DecisionType.NONE,
          success: false,
          events: [],
        };
    }
  }

  private noopResult(actorId: string, type: DecisionType): ActionResult {
    return {
      actorId,
      type,
      success: false,
      events: [],
    };
  }
}

function isContinuousAction(type: DecisionType): boolean {
  return (
    type === DecisionType.PRESS ||
    type === DecisionType.MARK ||
    type === DecisionType.COVER ||
    type === DecisionType.MOVE ||
    type === DecisionType.POSITION ||
    type === DecisionType.NONE
  );
}

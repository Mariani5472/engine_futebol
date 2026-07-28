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
import { PipelineBuilder } from "./PipelineBuilder";
import { PipelineExecution, PipelinePhase } from "./PipelineExecution";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";

/**
 * Creates and advances physical action executions via pipelines.
 *
 * Contract:
 * - Evaluators only produce Decision.
 * - Every discrete action is born inside a PipelineExecution
 *   (even single-step pipelines).
 * - MatchState is mutated ONLY when a step reaches EXECUTING
 *   and wins arbitration.
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
  private readonly pipelineBuilder = new PipelineBuilder();

  constructor(referee: RefereeSystem) {
    this.tackle = new TackleAction(referee);
  }

  /**
   * Expand primary decision into a pipeline and start it.
   * Returns the pipeline if created.
   */
  public tryStart(
    decision: Decision,
    player: PlayerMatchState,
    currentTime: number,
  ): PipelineExecution | undefined {
    if (player.isActionBusy()) return undefined;

    if (isContinuousAction(decision.type)) {
      return undefined;
    }

    const profile = getActionExecutionProfile(decision.type);
    if (!profile) return undefined;

    const steps = this.pipelineBuilder.build(decision, player);
    return PipelineExecution.start(steps, player, currentTime);
  }

  /**
   * Advance a player's pipeline (or legacy standalone action).
   * Returns the ActionExecution that just reached EXECUTING, if any.
   */
  public advanceOnly(
    player: PlayerMatchState,
    currentTime: number,
  ): ActionExecutionPhase | undefined {
    // Pipeline path (preferred).
    if (player.activePipeline) {
      const pipeline = player.activePipeline;

      if (pipeline.phase === PipelinePhase.INTERRUPTED) {
        pipeline.finalizeIfDone(currentTime);
        return player.activeAction?.phase;
      }

      const result = pipeline.advance(currentTime);

      if (result.justReachedExecuting) {
        return ActionExecutionPhase.EXECUTING;
      }

      if (pipeline.isFinished) {
        return ActionExecutionPhase.COMPLETED;
      }

      return player.activeAction?.phase;
    }

    // Legacy single-action path (tests / edge cases).
    if (!player.activeAction) return undefined;

    const phase = player.activeAction.advance(currentTime);

    if (phase === ActionExecutionPhase.COMPLETED) {
      player.activeAction = undefined;
    }

    return phase;
  }

  /**
   * Apply football outcome for an EXECUTING step that won arbitration,
   * then mark the pipeline step as resolved (→ RECOVERING).
   */
  public resolveExecuting(
    execution: ActionExecution,
    context: ActionContext,
  ): ActionResult {
    const result = this.executeAction(execution.decision, context);

    const pipeline = context.player.activePipeline;
    if (pipeline && pipeline.currentAction === execution) {
      pipeline.markStepResolved(context.matchSecond);
    } else {
      // Legacy path: advance EXECUTING → RECOVERING directly.
      execution.markResolved(context.matchSecond);
    }

    return result;
  }

  /**
   * @deprecated Prefer scheduler: tryStart → advanceOnly → resolveExecuting.
   */
  public execute(
    decision: Decision,
    context: ActionContext,
  ): ActionResult {
    const player = context.player;

    if (player.activeAction || player.activePipeline) {
      const phase = this.advanceOnly(player, context.matchSecond);

      if (phase === ActionExecutionPhase.EXECUTING && player.activeAction) {
        return this.resolveExecuting(player.activeAction, context);
      }

      return this.noopResult(
        player.player.id,
        player.activeAction?.type ?? decision.type,
      );
    }

    const pipeline = this.tryStart(decision, player, context.matchSecond);
    if (pipeline) {
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

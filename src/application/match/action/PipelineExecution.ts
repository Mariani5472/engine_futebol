import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import {
  ActionExecution,
  ActionExecutionPhase,
  ActionInterruptionReason,
} from "./ActionExecution";

/**
 * Lifecycle of a multi-step play sequence.
 *
 * A pipeline owns a ordered list of Decisions. Each step is realized as a
 * full ActionExecution (PREPARING → EXECUTING → RECOVERING → COMPLETED).
 * When a step completes, the next step starts automatically — without going
 * back through the DecisionSystem — so the whole sequence belongs to one play.
 *
 * Example:
 *   RECEIVE → CONTROL → DRIBBLE → SKILL_MOVE → SHOT
 */
export enum PipelinePhase {
  IDLE = "IDLE",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  INTERRUPTED = "INTERRUPTED",
}

export interface PipelineStep {
  readonly decision: Decision;
}

export interface PipelineAdvanceResult {
  readonly phase: PipelinePhase;
  /** Set when the current step just transitioned into EXECUTING this tick. */
  readonly justReachedExecuting?: ActionExecution;
  /** Set when a step finished and the next one was started. */
  readonly steppedForward?: boolean;
}

export class PipelineExecution {
  public phase: PipelinePhase = PipelinePhase.IDLE;
  public currentIndex = 0;
  public currentAction?: ActionExecution;
  public interruptionReason?: ActionInterruptionReason;

  public readonly steps: readonly PipelineStep[];
  public readonly startedAt: number;

  private constructor(
    steps: PipelineStep[],
    private readonly player: PlayerMatchState,
    startedAt: number,
  ) {
    this.steps = steps;
    this.startedAt = startedAt;
  }

  public get currentDecision(): Decision | undefined {
    return this.steps[this.currentIndex]?.decision;
  }

  public get currentType(): DecisionType | undefined {
    return this.currentDecision?.type;
  }

  public get remainingSteps(): readonly PipelineStep[] {
    return this.steps.slice(this.currentIndex);
  }

  public get isFinished(): boolean {
    return (
      this.phase === PipelinePhase.COMPLETED ||
      this.phase === PipelinePhase.INTERRUPTED
    );
  }

  public isBusy(): boolean {
    return this.phase === PipelinePhase.ACTIVE;
  }

  /**
   * Create and begin a pipeline from an ordered list of decisions.
   * Starts the first ActionExecution immediately.
   */
  public static start(
    decisions: Decision[],
    player: PlayerMatchState,
    currentTime: number,
  ): PipelineExecution | undefined {
    if (decisions.length === 0) return undefined;

    const steps: PipelineStep[] = decisions.map((decision) => ({ decision }));
    const pipeline = new PipelineExecution(steps, player, currentTime);

    const first = ActionExecution.start(decisions[0], player, currentTime);
    if (!first) return undefined;

    pipeline.phase = PipelinePhase.ACTIVE;
    pipeline.currentIndex = 0;
    pipeline.currentAction = first;
    player.activeAction = first;
    player.activePipeline = pipeline;

    return pipeline;
  }

  /**
   * Advance the current step's ActionExecution.
   *
   * - If the step reaches EXECUTING → report it for arbitration/resolution.
   * - If the step reaches COMPLETED → start the next step (or finish pipeline).
   * - Does NOT apply football outcomes; that remains ActionFactory.resolveExecuting.
   */
  public advance(currentTime: number): PipelineAdvanceResult {
    if (this.phase !== PipelinePhase.ACTIVE || !this.currentAction) {
      return { phase: this.phase };
    }

    const previousPhase = this.currentAction.phase;
    const phase = this.currentAction.advance(currentTime);

    // Just transitioned into EXECUTING this call.
    if (
      phase === ActionExecutionPhase.EXECUTING &&
      previousPhase === ActionExecutionPhase.PREPARING
    ) {
      return {
        phase: this.phase,
        justReachedExecuting: this.currentAction,
      };
    }

    // Step fully recovered → advance pipeline or complete.
    if (phase === ActionExecutionPhase.COMPLETED) {
      return this.advanceToNextStep(currentTime);
    }

    return { phase: this.phase };
  }

  /**
   * Called by the scheduler after a winning EXECUTING step has had its
   * outcome applied. Moves the current ActionExecution into RECOVERING.
   */
  public markStepResolved(currentTime: number): void {
    if (!this.currentAction) return;
    if (this.currentAction.phase === ActionExecutionPhase.EXECUTING) {
      this.currentAction.advance(currentTime);
    }
  }

  /**
   * Interrupt the entire pipeline (e.g. tackle, collision).
   * Cancels remaining steps; current action enters recovery via interrupt.
   */
  public interrupt(
    reason: ActionInterruptionReason,
    currentTime: number,
  ): boolean {
    if (this.phase !== PipelinePhase.ACTIVE) return false;

    this.interruptionReason = reason;
    this.phase = PipelinePhase.INTERRUPTED;

    if (this.currentAction?.isBusy()) {
      this.currentAction.interrupt(reason, currentTime);
    }

    // Keep activeAction so recovery can finish; clear pipeline ownership later
    // when the interrupted action reaches COMPLETED.
    return true;
  }

  /**
   * After an interrupted current action finishes recovery, clear references.
   */
  public finalizeIfDone(currentTime: number): void {
    if (this.phase === PipelinePhase.INTERRUPTED && this.currentAction) {
      const phase = this.currentAction.advance(currentTime);
      if (
        phase === ActionExecutionPhase.COMPLETED ||
        !this.currentAction.isBusy()
      ) {
        this.clearPlayerRefs();
      }
    }
  }

  private advanceToNextStep(currentTime: number): PipelineAdvanceResult {
    const nextIndex = this.currentIndex + 1;

    if (nextIndex >= this.steps.length) {
      this.phase = PipelinePhase.COMPLETED;
      this.clearPlayerRefs();
      return { phase: this.phase, steppedForward: false };
    }

    const nextDecision = this.steps[nextIndex].decision;
    const nextAction = ActionExecution.start(
      nextDecision,
      this.player,
      currentTime,
    );

    if (!nextAction) {
      // Cannot start next step (no profile / continuous) → end pipeline.
      this.phase = PipelinePhase.COMPLETED;
      this.clearPlayerRefs();
      return { phase: this.phase, steppedForward: false };
    }

    this.currentIndex = nextIndex;
    this.currentAction = nextAction;
    this.player.activeAction = nextAction;

    return {
      phase: this.phase,
      steppedForward: true,
    };
  }

  private clearPlayerRefs(): void {
    this.currentAction = undefined;
    if (this.player.activePipeline === this) {
      this.player.activePipeline = undefined;
    }
    // Only clear activeAction if it still points at a finished step.
    if (
      this.player.activeAction &&
      !this.player.activeAction.isBusy()
    ) {
      this.player.activeAction = undefined;
    }
  }
}

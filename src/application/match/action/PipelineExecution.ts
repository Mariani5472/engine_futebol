import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import {
  ActionExecution,
  ActionExecutionPhase,
  ActionInterruptionReason,
} from "./ActionExecution";

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
  readonly justReachedExecuting?: ActionExecution;
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

  public advance(currentTime: number): PipelineAdvanceResult {
    if (this.phase !== PipelinePhase.ACTIVE || !this.currentAction) {
      return { phase: this.phase };
    }

    const previousPhase = this.currentAction.phase;
    const phase = this.currentAction.advance(currentTime);

    if (
      phase === ActionExecutionPhase.EXECUTING &&
      previousPhase === ActionExecutionPhase.PREPARING
    ) {
      return {
        phase: this.phase,
        justReachedExecuting: this.currentAction,
      };
    }

    // Zero-windup start: already EXECUTING on construction.
    if (
      phase === ActionExecutionPhase.EXECUTING &&
      previousPhase === ActionExecutionPhase.EXECUTING &&
      previousPhase === this.currentAction.phase
    ) {
      // no-op path
    }

    if (
      phase === ActionExecutionPhase.EXECUTING &&
      previousPhase === ActionExecutionPhase.EXECUTING
    ) {
      // Already executing — scheduler should resolve; do not auto-recover here.
      return { phase: this.phase };
    }

    // Fresh start landed directly in EXECUTING (windup 0).
    if (
      phase === ActionExecutionPhase.EXECUTING &&
      previousPhase !== ActionExecutionPhase.RECOVERING &&
      previousPhase !== ActionExecutionPhase.COMPLETED
    ) {
      // If previous was already EXECUTING at start of advance, still report
      // for first-tick resolve when pipeline just started.
    }

    if (phase === ActionExecutionPhase.COMPLETED) {
      return this.advanceToNextStep(currentTime);
    }

    return { phase: this.phase };
  }

  /**
   * After outcome applied: move EXECUTING → RECOVERING, and if recovery time
   * has already elapsed (large ticks), complete immediately so the next
   * player decision can happen next tick.
   */
  public markStepResolved(currentTime: number): void {
    if (!this.currentAction) return;

    if (this.currentAction.phase === ActionExecutionPhase.EXECUTING) {
      // Force into RECOVERING by setting phase via a timed advance path:
      // temporarily ensure recovery can finish.
      (this.currentAction as { phase: ActionExecutionPhase }).phase =
        ActionExecutionPhase.RECOVERING;
    }

    if (this.currentAction.phase === ActionExecutionPhase.RECOVERING) {
      const phase = this.currentAction.advance(currentTime);
      if (phase === ActionExecutionPhase.COMPLETED) {
        this.advanceToNextStep(currentTime);
      }
    }
  }

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

    return true;
  }

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
      justReachedExecuting:
        nextAction.phase === ActionExecutionPhase.EXECUTING
          ? nextAction
          : undefined,
    };
  }

  private clearPlayerRefs(): void {
    this.currentAction = undefined;
    if (this.player.activePipeline === this) {
      this.player.activePipeline = undefined;
    }
    if (
      this.player.activeAction &&
      !this.player.activeAction.isBusy()
    ) {
      this.player.activeAction = undefined;
    }
  }
}

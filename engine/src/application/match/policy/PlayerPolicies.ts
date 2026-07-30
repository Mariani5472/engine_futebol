import type { Random } from "../../../core/random/Random";
import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import {
  commandDecision,
  type PlayerActionCommand,
  type PlayerPolicy,
  type PlayerPolicyInput,
  type PlayerPolicyProposal,
  type PlayerPolicyResult,
} from "./PlayerPolicy";

export class HeuristicPlayerPolicy implements PlayerPolicy {
  public readonly id = "heuristic-v1";
  public readonly fallback = "HEURISTIC" as const;

  public decide(input: PlayerPolicyInput): PlayerPolicyProposal {
    return { decision: input.heuristicDecision(), canonical: true };
  }
}

export class ScriptedPlayerPolicy implements PlayerPolicy {
  public readonly fallback = "HEURISTIC" as const;
  private index = 0;

  public constructor(
    private readonly commands: readonly PlayerActionCommand[],
    public readonly id = "scripted-v1",
  ) {}

  public decide(_input: PlayerPolicyInput): PlayerPolicyProposal | undefined {
    const command = this.commands[this.index++];
    return command ? { decision: commandDecision(command), canonical: false } : undefined;
  }
}

export class RandomValidPlayerPolicy implements PlayerPolicy {
  public readonly fallback = "SAFE" as const;

  public constructor(
    private readonly random: Random,
    public readonly id = "random-valid-v1",
  ) {}

  public decide(input: PlayerPolicyInput): PlayerPolicyProposal | undefined {
    if (!input.validDecisions.length) return undefined;
    const decision = input.validDecisions[this.random.nextInt(0, input.validDecisions.length - 1)];
    return { decision, canonical: false };
  }
}

export class ExternalPlayerPolicy implements PlayerPolicy {
  public readonly fallback = "SAFE" as const;
  private readonly pending: PlayerActionCommand[] = [];

  public constructor(public readonly id = "external-v1") {}

  public submit(command: PlayerActionCommand): void {
    const decision = commandDecision(command);
    if (decision.type === DecisionType.NONE) throw new Error("External policy cannot submit NONE");
    this.pending.push(command);
  }

  public pendingCount(): number { return this.pending.length; }

  public decide(_input: PlayerPolicyInput): PlayerPolicyProposal | undefined {
    const command = this.pending.shift();
    return command ? { decision: commandDecision(command), canonical: false } : undefined;
  }
}

/** Synchronous environment policy: no command means stop at a decision gate. */
export class DecisionGatePlayerPolicy implements PlayerPolicy {
  public readonly fallback = "SAFE" as const;
  private pending: PlayerActionCommand | null = null;
  private waiting = false;

  public constructor(public readonly id = "decision-gate-v1") {}

  public submit(command: PlayerActionCommand): void {
    const decision = commandDecision(command);
    if (decision.type === DecisionType.NONE) throw new Error("Decision gate cannot submit NONE");
    if (this.pending) throw new Error("Decision gate already has a pending action");
    this.pending = command;
    this.waiting = false;
  }

  public isWaiting(): boolean { return this.waiting && this.pending === null; }

  public decide(_input: PlayerPolicyInput): PlayerPolicyResult {
    if (!this.pending) {
      this.waiting = true;
      return { waitForAction: true };
    }
    const command = this.pending;
    this.pending = null;
    this.waiting = false;
    return { decision: commandDecision(command), canonical: false };
  }
}

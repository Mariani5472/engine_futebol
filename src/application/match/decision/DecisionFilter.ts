import {
  Decision,
} from "./Decision";

import {
  DecisionContext,
} from "./DecisionContext";
import { DecisionType } from "./DecisionType";

export interface DecisionFilterResult {
  readonly decision: Decision;
  readonly legal: boolean;
  readonly reason?: string;
}

export class DecisionFilter {
  public filter(
    decisions: readonly Decision[],
    context: DecisionContext
  ): Decision[] {

    return decisions.filter(decision => this.isLegal(
      decision,
      context
    ));
  }

  public evaluate(
    decision: Decision,
    context: DecisionContext
  ): DecisionFilterResult {

    const result = this.validate(
      decision,
      context
    );

    return {
      decision,
      legal: result.legal,
      reason: result.reason,
    };
  }

  private isLegal(
    decision: Decision,
    context: DecisionContext
  ): boolean {

    return this.validate(
      decision,
      context
    ).legal;
  }

  private validate(
    decision: Decision,
    context: DecisionContext
  ): {
    legal: boolean;
    reason?: string;
  } {

    switch (decision.type) {
      case DecisionType.PASS:
        return this.validatePass(
          decision,
          context
        );

      case DecisionType.SHOT:
        return this.validateShot(
          context
        );

      case DecisionType.DRIBBLE:
        return this.validateDribble(
          context
        );

      case DecisionType.HOLD_BALL:
        return this.validateHoldBall(
          context
        );

      default:
        return {
          legal: true,
        };
    }
  }

  private validatePass(
    decision: Decision,
    context: DecisionContext
  ) {

    if (!decision.targetId) {
      return {
        legal: false,
        reason: "PASS_REQUIRES_TARGET",
      };
    }

    const teammate =
      context.awareness.teammates.get(
        decision.targetId
      );

    if (!teammate) {
      return {
        legal: false,
        reason: "TARGET_NOT_AWARE",
      };
    }

    if (
      !teammate.isReliable()
    ) {
      return {
        legal: false,
        reason: "TARGET_MEMORY_UNRELIABLE",
      };
    }

    return {
      legal: true,
    };
  }

  private validateShot(
    context: DecisionContext
  ) {

    if (
      !context.awareness.ball
    ) {
      return {
        legal: false,
        reason: "BALL_NOT_AVAILABLE",
      };
    }

    return {
      legal: true,
    };
  }

  private validateDribble(
    context: DecisionContext
  ) {

    if (
      !context.awareness.ball
    ) {
      return {
        legal: false,
        reason: "BALL_NOT_AVAILABLE",
      };
    }

    return {
      legal: true,
    };
  }

  private validateHoldBall(
    context: DecisionContext
  ) {

    return {
      legal: true,
    };
  }
}
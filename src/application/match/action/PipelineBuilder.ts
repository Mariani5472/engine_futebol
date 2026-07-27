import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";

/**
 * Builds ordered decision sequences that form a single coherent play.
 *
 * The DecisionSystem still selects a *primary* Decision (highest utility).
 * PipelineBuilder expands that primary into a natural sequence when the
 * football context calls for setup or follow-up actions.
 *
 * Examples:
 *   RECEIVE          → [RECEIVE, CONTROL]
 *   SHOT after receive → [CONTROL, SHOT]
 *   DRIBBLE + skill  → [DRIBBLE, SKILL_MOVE]
 *   PASS after receive → [CONTROL, PASS]
 *
 * Single-step pipelines are still valid — every discrete action goes through
 * PipelineExecution so the scheduler has one uniform path.
 */
export class PipelineBuilder {

  /**
   * Expand a primary decision into an ordered list of steps.
   * Always returns at least the primary decision itself.
   */
  public build(
    primary: Decision,
    player: PlayerMatchState,
  ): Decision[] {
    switch (primary.type) {
      case DecisionType.RECEIVE:
        return this.receivePipeline(primary);

      case DecisionType.SHOT:
        return this.shotPipeline(primary, player);

      case DecisionType.PASS:
      case DecisionType.CROSS:
      case DecisionType.CLEAR:
      case DecisionType.GK_DISTRIBUTE:
        return this.releasePipeline(primary, player);

      case DecisionType.DRIBBLE:
        return this.dribblePipeline(primary, player);

      case DecisionType.HEADER:
        return this.headerPipeline(primary, player);

      case DecisionType.SKILL_MOVE:
        return this.skillMovePipeline(primary, player);

      // Defensive / discrete single actions — no expansion.
      case DecisionType.TACKLE:
      case DecisionType.INTERCEPT:
      case DecisionType.BLOCK:
      case DecisionType.TACTICAL_FOUL:
      case DecisionType.GK_CLAIM:
      case DecisionType.CONTROL:
      case DecisionType.HOLD_BALL:
      case DecisionType.FAKE:
      case DecisionType.SET_PIECE:
        return [primary];

      default:
        return [primary];
    }
  }

  /** RECEIVE → CONTROL — settle the first touch into controlled possession. */
  private receivePipeline(primary: Decision): Decision[] {
    return [
      primary,
      new Decision(
        DecisionType.CONTROL,
        primary.utility * 0.92,
        primary.targetId,
      ),
    ];
  }

  /**
   * SHOT pipeline.
   * If the player has not yet controlled the ball (just received / loose),
   * prepend CONTROL so the shot is part of a settled sequence.
   */
  private shotPipeline(primary: Decision, player: PlayerMatchState): Decision[] {
    if (this.needsControlSetup(player)) {
      return [
        new Decision(DecisionType.CONTROL, primary.utility * 0.85),
        primary,
      ];
    }
    return [primary];
  }

  /**
   * Pass / cross / clear pipeline.
   * After a fresh receive, force a control touch before releasing the ball.
   */
  private releasePipeline(
    primary: Decision,
    player: PlayerMatchState,
  ): Decision[] {
    if (this.needsControlSetup(player)) {
      return [
        new Decision(DecisionType.CONTROL, primary.utility * 0.85),
        primary,
      ];
    }
    return [primary];
  }

  /**
   * DRIBBLE pipeline.
   * High-skill players may chain a skill move as the second beat of the same play.
   */
  private dribblePipeline(
    primary: Decision,
    player: PlayerMatchState,
  ): Decision[] {
    if (this.canChainSkillMove(player)) {
      return [
        primary,
        new Decision(
          DecisionType.SKILL_MOVE,
          primary.utility * 0.80,
          primary.targetId,
        ),
      ];
    }
    return [primary];
  }

  /**
   * HEADER pipeline.
   * Aerial duel often needs a brief control/settle if the ball is contested
   * on the ground after the header attempt fails — kept single for now.
   */
  private headerPipeline(primary: Decision, _player: PlayerMatchState): Decision[] {
    return [primary];
  }

  /**
   * SKILL_MOVE as primary — optionally followed by a release if the player
   * is already in an advanced attacking position is deferred to later phases.
   */
  private skillMovePipeline(
    primary: Decision,
    _player: PlayerMatchState,
  ): Decision[] {
    return [primary];
  }

  /**
   * True when the last discrete action was a receive (or the player has the
   * ball but body/last-action state indicates an unsettled first touch).
   */
  private needsControlSetup(player: PlayerMatchState): boolean {
    if (player.lastActionType === DecisionType.RECEIVE) return true;
    if (player.lastActionType === DecisionType.CONTROL) return false;

    // Fresh possession with low balance after a challenge / loose ball.
    if (player.hasBall && this.normalize(player.balance) < 0.55) return true;

    return false;
  }

  /**
   * Skill-move chaining: requires solid technical + agility attributes and
   * a body state that can still support a second beat.
   */
  private canChainSkillMove(player: PlayerMatchState): boolean {
    const attrs = player.player.attributes;
    const technical = attrs.technical as unknown as Record<string, number>;
    const dribbling = (technical.dribbling ?? 10) / 20;
    const technique = (technical.technique ?? 10) / 20;
    const agility = attrs.physical.agility / 20;

    const skillScore = dribbling * 0.45 + technique * 0.30 + agility * 0.25;
    if (skillScore < 0.62) return false;

    if (
      player.bodyState === "FALLING" ||
      player.bodyState === "GROUND"
    ) {
      return false;
    }

    return true;
  }

  private normalize(value: number): number {
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}

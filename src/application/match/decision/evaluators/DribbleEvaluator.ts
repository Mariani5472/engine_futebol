import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PositionInfluenceCalculator } from "../../position/PositionInfluenceCalculator";

export class DribbleEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (!context.player.hasBall) return [];

    const options = [
      this.createDecision(DecisionType.DRIBBLE, this.calculateDribbleUtility(context)),
      this.createDecision(DecisionType.SKILL_MOVE, this.calculateSkillMoveUtility(context)),
    ];

    return options.filter((decision) => decision.utility > 0);
  }

  private createDecision(type: DecisionType, score: UtilityScore): Decision {
    return new Decision(type, score.total, undefined, score.reasons, score.components);
  }

  private calculateDribbleUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const world = context.world;
    const dribbling = (attrs.technical.dribbling ?? 10) / 20;
    const pace = (attrs.physical.pace ?? 10) / 20;
    const flair = (attrs.mental.flair ?? 10) / 20;
    const agility = (attrs.physical.agility ?? 10) / 20;

    const freeSpace = world.freeSpace;
    const pressure = world.pressure;
    const nearest = world.nearestOpponentDistance;

    if (freeSpace < 0.18 && pressure > 0.55) {
      return UtilityScore.fromComponents({ SPACE: 0 });
    }

    const pitchLength = context.match.pitch.length;
    const mid = pitchLength / 2;
    const playerX = context.player.position.x;
    const inOpponentHalf =
      world.attackingDirection === 1 ? playerX >= mid : playerX <= mid;
    const nearFinalThird =
      world.goalDistance <= 35 ||
      (world.attackingDirection === 1
        ? playerX >= pitchLength * 0.65
        : playerX <= pitchLength * 0.35);

    // Carry into the box only with space in the opponent half / final third.
    const carryBonus =
      inOpponentHalf && freeSpace > 0.35
        ? 18 + (nearFinalThird ? 14 : 0)
        : inOpponentHalf
          ? 6
          : 0;

    const pitchCentreX = pitchLength / 2;
    const attackingX =
      world.attackingDirection === 1
        ? playerX - pitchCentreX
        : pitchCentreX - playerX;
    const fieldAdvanceFactor = Math.max(0, Math.min(1, attackingX / pitchCentreX));
    const isAttacking = PositionInfluenceCalculator.isAttackingRole(
      context.player.currentRole,
    );
    const roleBonus = isAttacking
      ? 8 + fieldAdvanceFactor * 10
      : 2 + fieldAdvanceFactor * 4;

    const spaceGate = Math.max(0, freeSpace * 22 - pressure * 20);

    let escapeBonus = 0;
    if (Number.isFinite(nearest) && nearest > 1.5 && nearest < 5) {
      escapeBonus = (dribbling + agility + pace) * 3;
    }

    let repeatPenalty = 0;
    if (context.player.lastActionType === DecisionType.DRIBBLE) {
      // Allow chained carries in open final third; punish elsewhere.
      repeatPenalty = nearFinalThird && freeSpace > 0.4 ? 6 : freeSpace > 0.55 ? 12 : 38;
    }
    if (context.player.lastActionType === DecisionType.SKILL_MOVE) {
      repeatPenalty += 10;
    }

    // Own half: keep dribble modest so progressive pass remains preferred.
    const ownHalfPenalty = !inOpponentHalf ? -14 : 0;

    const technique = dribbling * 12 + pace * 5 + flair * 4 + agility * 3;

    return UtilityScore.fromComponents({
      TECHNIQUE: technique,
      ROLE: roleBonus,
      SPACE: spaceGate + escapeBonus + carryBonus,
      PRESSURE: -pressure * 22,
      RISK: -repeatPenalty + ownHalfPenalty,
    });
  }

  private calculateSkillMoveUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const world = context.world;
    const dribbling = (attrs.technical.dribbling ?? 10) / 20;
    const flair = (attrs.mental.flair ?? 10) / 20;
    const agility = (attrs.physical.agility ?? 10) / 20;
    const technique = (attrs.technical.technique ?? 10) / 20;

    const pressure = world.pressure;
    const nearestOpponentDistance = world.nearestOpponentDistance;

    if (pressure < 0.25 || pressure > 0.85) {
      return UtilityScore.fromComponents({ SPACE: 0 });
    }
    if (context.player.lastActionType === DecisionType.SKILL_MOVE) {
      return UtilityScore.fromComponents({ SPACE: 0 });
    }

    const pressureWindow = Math.max(
      0,
      Math.min(1, 1 - Math.abs(pressure - 0.55) / 0.55),
    );
    const spacePenalty = nearestOpponentDistance < 1.2 ? 18 : 0;

    return UtilityScore.fromComponents({
      TECHNIQUE: dribbling * 10 + flair * 12 + agility * 6 + technique * 5,
      PRESSURE: pressureWindow * 10,
      SPACE: -spacePenalty,
    });
  }
}

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
      this.createDribbleDecision(context),
      this.createHoldBallDecision(context),
      this.createSkillMoveDecision(context),
    ];

    return options.filter((decision) => decision.utility > 0);
  }

  private createDribbleDecision(context: DecisionContext): Decision {
    const score = this.calculateDribbleUtility(context);
    return new Decision(DecisionType.DRIBBLE, score.total);
  }

  private createHoldBallDecision(context: DecisionContext): Decision {
    const score = this.calculateHoldBallUtility(context);
    return new Decision(DecisionType.HOLD_BALL, score.total);
  }

  private createSkillMoveDecision(context: DecisionContext): Decision {
    const score = this.calculateSkillMoveUtility(context);
    return new Decision(DecisionType.SKILL_MOVE, score.total);
  }

  private calculateDribbleUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const world = context.world;
    const dribbling = (attrs.technical.dribbling ?? 10) / 20;
    const pace = (attrs.physical.pace ?? 10) / 20;
    const flair = (attrs.mental.flair ?? 10) / 20;
    const agility = (attrs.physical.agility ?? 10) / 20;

    const pitchCentreX = context.match.pitch.length / 2;
    const playerX = context.player.position.x;
    const attackingX =
      world.attackingDirection === 1
        ? playerX - pitchCentreX
        : pitchCentreX - playerX;
    const fieldAdvanceFactor = Math.max(0, Math.min(1, attackingX / pitchCentreX));
    const isAttacking = PositionInfluenceCalculator.isAttackingRole(
      context.player.currentRole,
    );
    const roleBonus = isAttacking
      ? 18 + fieldAdvanceFactor * 15
      : 4 + fieldAdvanceFactor * 8;

    const pressure = world.pressure;
    const nearestOpponentDistance = world.nearestOpponentDistance;
    const pressurePenalty = pressure * 18;
    const escapeBonus = this.calculateEscapeBonus(
      dribbling,
      pace,
      agility,
      nearestOpponentDistance,
    );
    const spaceBonus = world.freeSpace * 8;

    return UtilityScore.fromComponents({
      TECHNIQUE: dribbling * 20 + pace * 8 + flair * 6 + agility * 4,
      ROLE: roleBonus,
      SPACE: spaceBonus + escapeBonus,
      PRESSURE: -pressurePenalty,
    });
  }

  private calculateHoldBallUtility(context: DecisionContext): UtilityScore {
    const attrs = context.player.player.attributes;
    const world = context.world;
    const composure = (attrs.mental.composure ?? 10) / 20;
    const strength = (attrs.physical.strength ?? 10) / 20;
    const balance = this.normalize(context.player.balance ?? 100);
    const stability = this.normalize(context.player.stability ?? 100);

    const pressure = world.pressure;

    return UtilityScore.fromComponents({
      TECHNIQUE: composure * 12 + strength * 10,
      BODY: balance * 8 + stability * 8,
      PRESSURE: pressure * 18, // hold-ball is MORE attractive under pressure
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

    const pressureWindow = Math.max(
      0,
      Math.min(1, 1 - Math.abs(pressure - 0.55) / 0.55),
    );
    const spacePenalty = nearestOpponentDistance < 1.2 ? 18 : 0;

    return UtilityScore.fromComponents({
      TECHNIQUE: dribbling * 18 + flair * 16 + agility * 10 + technique * 8,
      PRESSURE: pressureWindow * 14,
      SPACE: -spacePenalty,
    });
  }

  private calculateEscapeBonus(
    dribbling: number,
    pace: number,
    agility: number,
    nearestOpponentDistance: number,
  ): number {
    if (!Number.isFinite(nearestOpponentDistance) || nearestOpponentDistance > 5) {
      return 8;
    }
    if (nearestOpponentDistance > 3) return (dribbling + pace + agility) * 4;
    return (dribbling + agility) * 5;
  }

  private normalize(value: number): number {
    if (typeof value !== "number" || !Number.isFinite(value)) return 1;
    if (value <= 1) return Math.max(0, value);
    return Math.max(0, Math.min(1, value / 100));
  }
}

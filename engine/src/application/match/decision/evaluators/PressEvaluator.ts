import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { FieldThirdResolver } from "../../../../core/pitch/FieldThirdResolver";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionReadiness } from "./ActionReadiness";

export class PressEvaluator implements ActionEvaluator {
  private readonly fieldThirdResolver = new FieldThirdResolver(105);

  public evaluate(context: DecisionContext): Decision[] {
    if (context.player.hasBall) return [];

    const ballOwner = context.match.ball.owner;
    if (!ballOwner) return [];

    const isHome = context.match.home.players.includes(context.player);
    const ownerIsOpponent = isHome
      ? context.match.away.players.includes(ballOwner)
      : context.match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) return [];

    const distance = context.player.position.distanceTo(ballOwner.position);
    if (distance > 18) return [];

    const score = this.calculateUtility(context, distance, ballOwner);
    if (score.total < 10) return [];

    return [new Decision(DecisionType.PRESS, score.total)];
  }

  private calculateUtility(
    context: DecisionContext,
    distance: number,
    ballOwner: PlayerMatchState
  ): UtilityScore {
    const attrs = context.player.player.attributes;

    const workRate = attrs.mental.workRate / 20;
    const aggression = attrs.mental.aggression / 20;
    const stamina = context.player.stamina / 100;
    const anticipation = attrs.mental.anticipation / 20;
    const decisions = attrs.mental.decisions / 20;

    const pressureLaneBonus = Math.max(0, 18 - distance * 1.6);
    const ballOwnerPressure = this.calculateBallOwnerPressure(context, ballOwner);
    const fieldThirdBonus = this.calculateFieldThirdBonus(context);
    const roleBonus = this.calculateRoleBonus(context);
    const actionCommitmentBonus = this.calculateActionCommitmentBonus(context, ballOwner);
    const exposureBonus = this.calculatePreparationExposureBonus(context, ballOwner);
    const staminaModifier = Math.max(0.6, 0.5 + stamina * 0.5);

    const base = (
      workRate * 22 +
      aggression * 10 +
      anticipation * 8 +
      decisions * 6 +
      pressureLaneBonus +
      ballOwnerPressure +
      fieldThirdBonus +
      roleBonus +
      actionCommitmentBonus +
      exposureBonus
    ) * staminaModifier;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "WORK_RATE", value: workRate * 22 },
      { code: "AGGRESSION", value: aggression * 10 },
      { code: "ANTICIPATION", value: anticipation * 8 },
      { code: "PROXIMITY", value: pressureLaneBonus },
      { code: "BALL_OWNER_PRESSURE", value: ballOwnerPressure },
      { code: "FIELD_THIRD", value: fieldThirdBonus },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "ACTION_COMMITMENT", value: actionCommitmentBonus },
      { code: "PREPARATION_EXPOSURE", value: exposureBonus },
    ]);
  }

  private calculateActionCommitmentBonus(
    context: DecisionContext,
    ballOwner: PlayerMatchState
  ): number {
    const opportunity = ActionReadiness.interruptionOpportunity(
      ballOwner,
      context.player,
      ActionReadiness.currentTime(context),
    );

    if (opportunity <= 0) return 0;

    const actionBonus: Partial<Record<DecisionType, number>> = {
      [DecisionType.PASS]: 10,
      [DecisionType.CROSS]: 12,
      [DecisionType.SHOT]: 14,
      [DecisionType.CLEAR]: 10,
      [DecisionType.CONTROL]: 6,
      [DecisionType.DRIBBLE]: 8,
      [DecisionType.SKILL_MOVE]: 10,
      [DecisionType.FAKE]: 5,
    };

    return (actionBonus[ballOwner.activeAction?.type ?? DecisionType.NONE] ?? 0) * opportunity;
  }

  private calculatePreparationExposureBonus(
    context: DecisionContext,
    ballOwner: PlayerMatchState
  ): number {
    const opportunity = ActionReadiness.interruptionOpportunity(
      ballOwner,
      context.player,
      ActionReadiness.currentTime(context),
    );

    return opportunity * 8;
  }

  private calculateBallOwnerPressure(
    context: DecisionContext,
    ballOwner: PlayerMatchState
  ): number {
    const opponents = context.match.home.players.includes(context.player)
      ? context.match.away.players
      : context.match.home.players;

    const nearestTeammateToOwner = opponents.reduce((nearest, opponent) => {
      const distance = ballOwner.position.distanceTo(opponent.position);
      return Math.min(nearest, distance);
    }, Infinity);

    if (!Number.isFinite(nearestTeammateToOwner)) return 0;
    if (nearestTeammateToOwner < 2) return 14;
    if (nearestTeammateToOwner < 4) return 10;
    if (nearestTeammateToOwner < 6) return 6;
    return 2;
  }

  private calculateFieldThirdBonus(context: DecisionContext): number {
    const isHome = context.match.home.players.includes(context.player);
    const team = isHome ? context.match.home : context.match.away;
    const third = this.fieldThirdResolver.resolve(
      context.player.position,
      team.attackingDirection
    );

    if (third === "ATTACKING") return 12;
    if (third === "MIDDLE") return 7;
    return 2;
  }

  private calculateRoleBonus(context: DecisionContext): number {
    const role = String(context.player.currentRole).toUpperCase();

    if (role.includes("ST") || role.includes("CF") || role.includes("AM")) return 10;
    if (role.includes("CM") || role.includes("DM")) return 8;
    if (role.includes("FB") || role.includes("WB") || role.includes("CB")) return 5;
    return 3;
  }
}
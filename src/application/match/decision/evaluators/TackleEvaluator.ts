import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionReadiness } from "./ActionReadiness";

/**
 * Evaluates direct tackle attempts.
 *
 * A tackle is not only a function of distance and tackling skill. The defender
 * should recognize when the ball carrier is physically committed to a technical
 * action and therefore temporarily vulnerable to an interruption.
 */
export class TackleEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const ball = context.match.ball;
    const ballOwner = ball.owner;
    if (!ballOwner) return [];

    if (context.player.hasBall) return [];

    const isHome = context.match.home.players.includes(context.player);
    const ownerIsOpponent = isHome
      ? context.match.away.players.includes(ballOwner)
      : context.match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) return [];

    const distance = context.player.position.distanceTo(ballOwner.position);
    if (distance > 4.5) return [];

    const score = this.calculateUtility(context, ballOwner, distance);
    if (score.total < 14) return [];

    return [new Decision(DecisionType.TACKLE, score.total)];
  }

  private calculateUtility(
    context: DecisionContext,
    ballOwner: PlayerMatchState,
    distance: number
  ): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const defendingTeam = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const tackling = player.player.attributes.technical.tackling / 20;
    const aggression = player.player.attributes.mental.aggression / 20;
    const positioning = player.player.attributes.mental.positioning / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const anticipation = player.player.attributes.mental.anticipation / 20;
    const stamina = player.stamina / 100;

    const proximityBonus = Math.max(0, 22 - distance * 5.2);
    const ballOwnerPressure = this.calculateBallOwnerPressure(ballOwner, opponents);
    const ownGoalBonus = this.calculateOwnGoalUrgency(
      player,
      defendingTeam.attackingDirection,
      match.pitch.length
    );
    const roleBonus = this.calculateRoleBonus(player);

    const currentTime = ActionReadiness.currentTime(context);
    const interruptionOpportunity = ActionReadiness.interruptionOpportunity(
      ballOwner,
      player,
      currentTime,
    );

    const targetBodyQuality = ActionReadiness.bodyQuality({
      ...context,
      player: ballOwner,
    } as DecisionContext);

    const preparationBonus = this.calculatePreparationBonus(
      ballOwner,
      interruptionOpportunity,
    );

    const vulnerabilityBonus = this.calculateVulnerabilityBonus(
      targetBodyQuality,
      interruptionOpportunity,
    );

    const staminaModifier = Math.max(0.65, 0.45 + stamina * 0.55);

    const base = (
      tackling * 28 +
      aggression * 12 +
      positioning * 10 +
      anticipation * 8 +
      decisions * 5 +
      proximityBonus +
      ballOwnerPressure +
      ownGoalBonus +
      roleBonus +
      preparationBonus +
      vulnerabilityBonus
    ) * staminaModifier;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "TACKLING", value: tackling * 28 },
      { code: "AGGRESSION", value: aggression * 12 },
      { code: "POSITIONING", value: positioning * 10 },
      { code: "ANTICIPATION", value: anticipation * 8 },
      { code: "PROXIMITY", value: proximityBonus },
      { code: "BALL_OWNER_PRESSURE", value: ballOwnerPressure },
      { code: "OWN_GOAL_URGENCY", value: ownGoalBonus },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "PREPARATION_WINDOW", value: preparationBonus },
      { code: "TARGET_VULNERABILITY", value: vulnerabilityBonus },
    ]);
  }

  private calculatePreparationBonus(
    ballOwner: PlayerMatchState,
    interruptionOpportunity: number,
  ): number {
    const actionType = ballOwner.activeAction?.type;
    if (!actionType || interruptionOpportunity <= 0) return 0;

    const technicalCommitment = {
      [DecisionType.PASS]: 14,
      [DecisionType.CROSS]: 16,
      [DecisionType.SHOT]: 18,
      [DecisionType.CLEAR]: 15,
      [DecisionType.HEADER]: 13,
      [DecisionType.CONTROL]: 8,
      [DecisionType.RECEIVE]: 8,
      [DecisionType.DRIBBLE]: 10,
      [DecisionType.SKILL_MOVE]: 12,
      [DecisionType.FAKE]: 8,
    }[actionType] ?? 0;

    return technicalCommitment * interruptionOpportunity;
  }

  private calculateVulnerabilityBonus(
    bodyQuality: number,
    interruptionOpportunity: number,
  ): number {
    const poorBodyQuality = 1 - bodyQuality;
    return poorBodyQuality * 8 * interruptionOpportunity;
  }

  private calculateBallOwnerPressure(
    ballOwner: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      const distance = ballOwner.position.distanceTo(opponent.position);
      return Math.min(nearest, distance);
    }, Infinity);

    if (!Number.isFinite(nearestOpponentDistance)) return 0;
    if (nearestOpponentDistance < 2) return 10;
    if (nearestOpponentDistance < 4) return 7;
    if (nearestOpponentDistance < 6) return 4;
    return 1;
  }

  private calculateOwnGoalUrgency(
    player: PlayerMatchState,
    attackingDirection: 1 | -1,
    pitchLength: number
  ): number {
    const ownGoalX = attackingDirection === 1 ? 0 : pitchLength;
    const distanceToOwnGoal = Math.abs(player.position.x - ownGoalX);

    if (distanceToOwnGoal < 15) return 10;
    if (distanceToOwnGoal < 25) return 7;
    if (distanceToOwnGoal < 35) return 4;
    return 1;
  }

  private calculateRoleBonus(player: PlayerMatchState): number {
    const role = String(player.currentRole).toUpperCase();

    if (role.includes("CB") || role.includes("DEF")) return 10;
    if (role.includes("DM")) return 8;
    if (role.includes("FB") || role.includes("WB")) return 6;
    if (role.includes("CM")) return 4;
    return 2;
  }
}

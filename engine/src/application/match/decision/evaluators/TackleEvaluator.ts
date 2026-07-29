import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionReadiness } from "./ActionReadiness";

export class TackleEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    if (ActionReadiness.currentTime(context) < context.player.tackleLockUntil) {
      return [];
    }

    const ballOwner = context.match.ball.owner;
    if (!ballOwner || context.player.hasBall) return [];
    if (ActionReadiness.currentTime(context) < ballOwner.possessionProtectedUntil) return [];

    const isHome = context.match.home.players.includes(context.player);
    const ownerIsOpponent = isHome
      ? context.match.away.players.includes(ballOwner)
      : context.match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) return [];

    const distance = context.player.position.distanceTo(context.match.ball.position);
    // Do not start impossible remote tackles that only pull more players into
    // an already congested ball zone. The action itself uses a 1.5m contact cap.
    if (distance > 1.45) return [];

    const score = this.calculateUtility(context, ballOwner, distance);
    if (score.total < 58) return [];

    return [
      new Decision(
        DecisionType.TACKLE,
        score.total,
        undefined,
        score.reasons,
        score.components,
      ),
    ];
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

    const tackling = (player.player.attributes.technical.tackling ?? 10) / 20;
    const aggression = (player.player.attributes.mental.aggression ?? 10) / 20;
    const positioning = (player.player.attributes.mental.positioning ?? 10) / 20;
    const decisions = (player.player.attributes.mental.decisions ?? 10) / 20;
    const anticipation = (player.player.attributes.mental.anticipation ?? 10) / 20;
    const stamina = (player.stamina ?? 100) / 100;

    const proximityBonus = Math.max(0, 22 - distance * 5.2);
    const ballOwnerPressure = this.calculateBallOwnerPressure(ballOwner, opponents);
    const ownGoalBonus = this.calculateOwnGoalUrgency(
      player,
      defendingTeam.attackingDirection,
      match.pitch.length,
    );
    const roleBonus = this.calculateRoleBonus(player);

    const currentTime = ActionReadiness.currentTime(context);
    const interruptionOpportunity = ActionReadiness.interruptionOpportunity(
      ballOwner,
      player,
      currentTime,
    );
    const targetBodyQuality = ActionReadiness.bodyQualityOf(ballOwner);
    const preparationBonus = this.calculatePreparationBonus(
      ballOwner,
      interruptionOpportunity,
    );
    const vulnerabilityBonus = this.calculateVulnerabilityBonus(
      targetBodyQuality,
      interruptionOpportunity,
    );

    const movementProfile = this.calculateTargetMovementProfile(ballOwner);
    const movementBonus = this.calculateMovementBonus(
      movementProfile,
      tackling,
      anticipation,
      decisions,
    );
    const movementRisk = this.calculateMovementRisk(
      movementProfile,
      distance,
      tackling,
    );

    const staminaModifier = Math.max(0.65, 0.45 + stamina * 0.55);

    const technique =
      tackling * 28 +
      aggression * 12 +
      anticipation * 8 +
      decisions * 5 +
      movementBonus;
    const space = proximityBonus;
    const pressure = ballOwnerPressure + preparationBonus + vulnerabilityBonus;
    const role = roleBonus + positioning * 10 + ownGoalBonus;
    const risk = -movementRisk;
    const raw = technique + space + pressure + role + risk;
    const fatigueAdj = raw * (staminaModifier - 1);

    return UtilityScore.fromComponents({
      SPACE: space,
      PRESSURE: pressure,
      TECHNIQUE: technique,
      ROLE: role,
      RISK: risk,
      FATIGUE: fatigueAdj,
      BODY: 0,
    });
  }

  private calculateTargetMovementProfile(target: PlayerMatchState): {
    speed: number;
    isStationary: boolean;
    isRunning: boolean;
    isTurning: boolean;
  } {
    const speed = target.velocity?.magnitude?.() ?? 0;
    const isStationary = speed < 0.35;
    const isRunning = speed > 3.5;

    if (isStationary || speed === 0) {
      return { speed, isStationary, isRunning, isTurning: false };
    }

    const movementDirection = target.velocity.normalize();
    const facing =
      !target.facingDirection || target.facingDirection.magnitude() === 0
        ? movementDirection
        : target.facingDirection.normalize();

    const alignment = facing.dot(movementDirection);
    return {
      speed,
      isStationary,
      isRunning,
      isTurning: alignment < 0.65,
    };
  }

  private calculateMovementBonus(
    profile: { isStationary: boolean; isRunning: boolean; isTurning: boolean },
    tackling: number,
    anticipation: number,
    decisions: number,
  ): number {
    let bonus = 0;

    if (profile.isStationary) bonus += 5;
    if (profile.isRunning) bonus += anticipation * 8 + tackling * 5;
    if (profile.isTurning) bonus += anticipation * 10 + decisions * 6;

    return bonus;
  }

  private calculateMovementRisk(
    profile: { speed: number; isStationary: boolean; isRunning: boolean; isTurning: boolean },
    distance: number,
    tackling: number,
  ): number {
    if (profile.isStationary) return 0;

    let risk = 0;
    if (profile.isRunning) risk += Math.max(0, profile.speed - 3.5) * 2.5;
    if (profile.isTurning) risk += Math.max(0, 6 - tackling * 6);
    if (distance > 3.5) risk += 5;

    return risk;
  }

  private calculatePreparationBonus(
    ballOwner: PlayerMatchState,
    interruptionOpportunity: number,
  ): number {
    const actionType = ballOwner.activeAction?.type;
    if (!actionType || interruptionOpportunity <= 0) return 0;

    const technicalCommitment: Partial<Record<DecisionType, number>> = {
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
    };

    return (technicalCommitment[actionType] ?? 0) * interruptionOpportunity;
  }

  private calculateVulnerabilityBonus(
    bodyQuality: number,
    interruptionOpportunity: number,
  ): number {
    return (1 - bodyQuality) * 8 * interruptionOpportunity;
  }

  private calculateBallOwnerPressure(
    ballOwner: PlayerMatchState,
    opponents: PlayerMatchState[],
  ): number {
    const nearestOpponentDistance = opponents.reduce((nearest, opponent) => {
      return Math.min(nearest, ballOwner.position.distanceTo(opponent.position));
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
    pitchLength: number,
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

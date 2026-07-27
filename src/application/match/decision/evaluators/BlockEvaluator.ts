import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";
import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";

/**
 * Evaluates block opportunities.
 *
 * BLOCK is a lane-protection action: the player tries to close the shooting or
 * passing line instead of directly pressing the ball carrier.
 */
export class BlockEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;

    if (player.hasBall) return [];

    const ballOwner = match.ball.owner;
    if (!ballOwner) return [];

    const isHome = match.home.players.includes(player);
    const ownerIsOpponent = isHome
      ? match.away.players.includes(ballOwner)
      : match.home.players.includes(ballOwner);

    if (!ownerIsOpponent) return [];

    const score = this.calculateUtility(context, ballOwner);
    if (score.total < 10) return [];

    return [new Decision(DecisionType.BLOCK, score.total)];
  }

  private calculateUtility(
    context: DecisionContext,
    ballOwner: PlayerMatchState
  ): UtilityScore {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const defendingTeam = isHome ? match.home : match.away;
    const attackingDirection = defendingTeam.attackingDirection;

    const ownGoal = this.getOwnGoal(match.pitch.length, match.pitch.width, attackingDirection);
    const ownerToGoalDistance = this.distancePointToSegment(
      player.position,
      ballOwner.position,
      ownGoal
    );
    const distanceToOwner = player.position.distanceTo(ballOwner.position);

    const positioning = player.player.attributes.mental.positioning / 20;
    const anticipation = player.player.attributes.mental.anticipation / 20;
    const decisions = player.player.attributes.mental.decisions / 20;
    const concentration = player.player.attributes.mental.concentration / 20;
    const tackling = player.player.attributes.technical.tackling / 20;

    const laneScore = Math.max(0, 10 - ownerToGoalDistance * 2.5);
    const proximityScore = Math.max(0, 14 - distanceToOwner * 1.8);
    const dangerScore = this.calculateDangerScore(player, defendingTeam.attackingDirection, match.pitch.length);
    const roleBonus = this.calculateRoleBonus(player);
    const pressureBonus = this.calculatePressureBonus(player, ballOwner);
    const staminaModifier = Math.max(0.65, 1 - player.fatigue / 180);

    const base = (
      positioning * 18 +
      anticipation * 10 +
      decisions * 8 +
      concentration * 6 +
      tackling * 5 +
      laneScore +
      proximityScore +
      dangerScore +
      roleBonus +
      pressureBonus
    ) * staminaModifier;

    return new UtilityScore(Math.max(0, base), 0, 0, 0, [
      { code: "POSITIONING", value: positioning * 18 },
      { code: "ANTICIPATION", value: anticipation * 10 },
      { code: "LANE", value: laneScore },
      { code: "PROXIMITY", value: proximityScore },
      { code: "DANGER", value: dangerScore },
      { code: "ROLE_BONUS", value: roleBonus },
      { code: "PRESSURE", value: pressureBonus },
    ]);
  }

  private getOwnGoal(
    pitchLength: number,
    pitchWidth: number,
    attackingDirection: 1 | -1
  ): { x: number; y: number } {
    return {
      x: attackingDirection === 1 ? 0 : pitchLength,
      y: pitchWidth / 2,
    };
  }

  private distancePointToSegment(
    p: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;

    const ab2 = abx * abx + aby * aby;
    if (ab2 === 0) {
      const dx = p.x - a.x;
      const dy = p.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    const closestX = a.x + t * abx;
    const closestY = a.y + t * aby;
    const dx = p.x - closestX;
    const dy = p.y - closestY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  private calculateDangerScore(
    player: PlayerMatchState,
    attackingDirection: 1 | -1,
    pitchLength: number
  ): number {
    const ownGoalX = attackingDirection === 1 ? 0 : pitchLength;
    const distanceToOwnGoal = Math.abs(player.position.x - ownGoalX);

    if (distanceToOwnGoal < 18) return 10;
    if (distanceToOwnGoal < 30) return 7;
    if (distanceToOwnGoal < 42) return 4;
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

  private calculatePressureBonus(player: PlayerMatchState, ballOwner: PlayerMatchState): number {
    const distance = player.position.distanceTo(ballOwner.position);

    if (distance < 2.5) return 12;
    if (distance < 4.5) return 8;
    if (distance < 6.5) return 4;
    return 1;
  }
}

import { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionType } from "../DecisionType";
import { UtilityScore } from "../UtilityScore";

/**
 * Evaluates emergency clearances for players in possession.
 *
 * CLEAR should be a safety valve, not a normal possession action. Its utility
 * rises when the player is under pressure and is located in a dangerous area.
 */
export class ClearEvaluator implements ActionEvaluator {
  public evaluate(context: DecisionContext): Decision[] {
    const { player, match } = context;
    const isHome = match.home.players.includes(player);
    const team = isHome ? match.home : match.away;
    const opponents = isHome ? match.away.players : match.home.players;

    const pressure = this.calculatePressure(player, opponents);
    const danger = this.calculateDanger(
      player,
      match.pitch.length,
      team.attackingDirection
    );
    const clearanceQuality = this.calculateClearanceQuality(player);

    const score = this.scoreClearance({
      pressure,
      danger,
      clearanceQuality,
      hasSafeTeammate: this.hasSafeTeammate(
        player,
        team.players,
        opponents
      ),
    });

    if (score.total <= 0) return [];

    return [new Decision(DecisionType.CLEAR, score.total)];
  }

  private scoreClearance(input: {
    pressure: number;
    danger: number;
    clearanceQuality: number;
    hasSafeTeammate: boolean;
  }): UtilityScore {
    const pressureScore = input.pressure * 42;
    const dangerScore = input.danger * 30;
    const qualityScore = input.clearanceQuality * 12;
    const safePassPenalty = input.hasSafeTeammate ? 24 : 0;

    const total = Math.max(
      0,
      pressureScore + dangerScore + qualityScore - safePassPenalty - 28
    );

    return new UtilityScore(total, 0, 0, 0, [
      { code: "PRESSURE", value: pressureScore },
      { code: "DANGER", value: dangerScore },
      { code: "CLEARANCE_QUALITY", value: qualityScore },
      { code: "SAFE_PASS_AVAILABLE", value: -safePassPenalty },
    ]);
  }

  private calculatePressure(
    player: PlayerMatchState,
    opponents: PlayerMatchState[]
  ): number {
    let pressure = 0;

    for (const opponent of opponents) {
      const distance = player.position.distanceTo(opponent.position);

      if (distance < 2.5) pressure += 0.55;
      else if (distance < 5) pressure += 0.25;
    }

    return Math.min(1, pressure);
  }

  private calculateDanger(
    player: PlayerMatchState,
    pitchLength: number,
    attackingDirection: 1 | -1
  ): number {
    const ownGoalX = attackingDirection === 1 ? 0 : pitchLength;
    const distanceToOwnGoal = Math.abs(player.position.x - ownGoalX);

    return Math.max(0, 1 - distanceToOwnGoal / 35);
  }

  private calculateClearanceQuality(player: PlayerMatchState): number {
    const technical = player.player.attributes.technical;
    const kicking = technical.kicking / 20;
    const technique = technical.technique / 20;

    return kicking * 0.6 + technique * 0.4;
  }

  private hasSafeTeammate(
    player: PlayerMatchState,
    teammates: PlayerMatchState[],
    opponents: PlayerMatchState[]
  ): boolean {
    return teammates.some((teammate) => {
      if (teammate === player) return false;

      const teammatePressure = opponents.some(
        (opponent) => teammate.position.distanceTo(opponent.position) < 5
      );

      return (
        !teammatePressure &&
        player.position.distanceTo(teammate.position) < 30
      );
    });
  }
}

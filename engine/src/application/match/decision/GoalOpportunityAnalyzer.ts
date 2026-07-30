import type { DecisionContext } from "./DecisionContext";

export interface GoalOpportunity {
  readonly shooterId: string;
  readonly shotAvailable: boolean;
  readonly shotQuality: number;
  readonly pressure: number;
  readonly goalkeeperCoverage: number;
  readonly blockerCoverage: number;
  readonly teammateBetterPositioned: boolean;
  readonly bestTeammateShotQuality?: number;
}

/** Compares the carrier's physical shooting window with every reachable teammate. */
export class GoalOpportunityAnalyzer {
  public analyze(context: DecisionContext): GoalOpportunity {
    const pressure = context.world.pressure;
    const blockerCoverage = this.blockerCoverage(context);
    const goalkeeper = context.world.opponents.find(player => String(player.currentRole).includes("GOALKEEPER"));
    const goalkeeperCoverage = goalkeeper
      ? clamp(1 - goalkeeper.position.distanceTo(context.world.goalCenter) / 9, .1, 1)
      : 0;
    const shotQuality = clamp(
      context.world.shotWindow * (1 - pressure * .38) * (1 - blockerCoverage * .68) * (1 - goalkeeperCoverage * .28),
      0, 1,
    );
    const teammateQualities = context.world.passingLanes
      .filter(lane => lane.clear)
      .map(lane => {
        const distance = lane.targetPosition.distanceTo(context.world.goalCenter);
        const angle = clamp(1 - Math.abs(lane.targetPosition.y - context.match.pitch.width / 2) / (context.match.pitch.width / 2), 0, 1);
        const futureLane = context.teamTacticalContext?.passingLanes.find(item => item.fromPlayerId === context.player.player.id && item.toPlayerId === lane.targetId);
        return clamp((1 - distance / 32) * .65 + angle * .35, 0, 1) * (futureLane?.clearAtArrival ? 1 : .45);
      });
    const bestTeammateShotQuality = teammateQualities.length ? Math.max(...teammateQualities) : undefined;
    return {
      shooterId: context.player.player.id,
      shotAvailable: context.world.goalDistance <= 32 && shotQuality >= .12,
      shotQuality,
      pressure,
      goalkeeperCoverage,
      blockerCoverage,
      teammateBetterPositioned: bestTeammateShotQuality !== undefined && bestTeammateShotQuality > shotQuality + .18,
      bestTeammateShotQuality,
    };
  }

  private blockerCoverage(context: DecisionContext): number {
    const from = context.player.position;
    const vector = context.world.goalCenter.subtract(from);
    const lengthSquared = Math.max(.01, vector.dot(vector));
    let result = 0;
    for (const opponent of context.world.opponents.filter(player => !String(player.currentRole).includes("GOALKEEPER"))) {
      const along = clamp(opponent.position.subtract(from).dot(vector) / lengthSquared, 0, 1);
      if (along < .04 || along > .98) continue;
      const point = from.add(vector.multiply(along));
      result = Math.max(result, clamp(1 - opponent.position.distanceTo(point) / 2.2, 0, 1));
    }
    return result;
  }
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));


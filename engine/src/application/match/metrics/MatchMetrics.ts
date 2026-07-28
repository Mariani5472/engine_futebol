import { TeamMatchMetrics } from "./TeamMatchMetrics";
import type { MatchTacticalDiagnostics } from "../diagnostics/TacticalDiagnosticsCollector";

/** Full match metrics snapshot produced at end of simulation (Phase 9). */
export interface MatchMetrics {
  readonly home: TeamMatchMetrics;
  readonly away: TeamMatchMetrics;
  /** Combined goals (home + away). */
  readonly totalGoals: number;
  /** Combined shots. */
  readonly totalShots: number;
  /** Combined shots on target. */
  readonly totalShotsOnTarget: number;
  readonly totalCorners: number;
  readonly totalFouls: number;
  readonly totalYellowCards: number;
  readonly totalRedCards: number;
  readonly totalxG: number;
  /** Average shot distance across both teams (metres). */
  readonly averageShotDistance: number;
  readonly tactical: MatchTacticalDiagnostics;
}

export function buildMatchMetrics(
  home: TeamMatchMetrics,
  away: TeamMatchMetrics,
  tactical: MatchTacticalDiagnostics,
): MatchMetrics {
  const totalShots = home.shots + away.shots;
  const shotDistanceSum =
    home.averageShotDistance * home.shots + away.averageShotDistance * away.shots;

  return {
    home,
    away,
    totalGoals: home.goals + away.goals,
    totalShots,
    totalShotsOnTarget: home.shotsOnTarget + away.shotsOnTarget,
    totalCorners: home.corners + away.corners,
    totalFouls: home.fouls + away.fouls,
    totalYellowCards: home.yellowCards + away.yellowCards,
    totalRedCards: home.redCards + away.redCards,
    totalxG: home.xG + away.xG,
    averageShotDistance: totalShots > 0 ? shotDistanceSum / totalShots : 0,
    tactical,
  };
}

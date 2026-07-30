import type { EventDerivedMatchReport, EventDerivedTeamReport } from "../analytics/MatchEventStore";
import type { MatchTacticalDiagnostics } from "../diagnostics/TacticalDiagnosticsCollector";
import { buildMatchMetrics, type MatchMetrics } from "./MatchMetrics";
import type { TeamMatchMetrics } from "./TeamMatchMetrics";

/**
 * Compatibility projection for the original MatchResult.metrics contract.
 * Every football count comes from MatchEventStore; this layer owns no counters.
 */
export function buildEventDerivedMatchMetrics(
  report: EventDerivedMatchReport,
  homeTeamId: string,
  awayTeamId: string,
  tactical: MatchTacticalDiagnostics,
): MatchMetrics {
  const homeReport = requiredTeam(report, homeTeamId);
  const awayReport = requiredTeam(report, awayTeamId);
  return buildMatchMetrics(
    projectTeam(homeReport, awayReport),
    projectTeam(awayReport, homeReport),
    tactical,
  );
}

function projectTeam(team: EventDerivedTeamReport, opponent: EventDerivedTeamReport): TeamMatchMetrics {
  const zoneActions = team.actionsByZone.OWN_THIRD + team.actionsByZone.MIDDLE_THIRD + team.actionsByZone.FINAL_THIRD;
  const defensiveActions = team.tackles + team.interceptions;
  return {
    goals: team.goals,
    shots: team.shots,
    shotsOnTarget: team.shotsOnTarget,
    shotsOffTarget: team.shotsOffTarget,
    shotsBlocked: team.shotsBlocked,
    // Historical contract: shots by this team that the opposing keeper saved.
    shotsSaved: opponent.goalkeeperSaves,
    xG: round(team.xG, 2),
    yellowCards: team.yellowCards,
    redCards: team.redCards,
    fouls: team.fouls,
    corners: team.corners,
    passes: team.passesAttempted,
    progressivePasses: team.progressivePasses,
    crosses: team.crosses,
    tackles: team.tackles,
    interceptions: team.interceptions,
    // No authoritative clearance event exists yet. Zero is preferable to a
    // second counter with incompatible semantics.
    clearances: 0,
    highPressRecoveries: team.highPressRecoveries,
    attacks: team.attacks,
    averageShotDistance: round(team.averageShotDistance, 1),
    possessionPercent: round(team.possessionPercent, 1),
    fieldTiltPercent: zoneActions > 0 ? round(team.actionsByZone.FINAL_THIRD / zoneActions * 100, 1) : 50,
    ppda: defensiveActions > 0 ? round(opponent.passesAttempted / defensiveActions, 1) : Number.POSITIVE_INFINITY,
  };
}

function requiredTeam(report: EventDerivedMatchReport, teamId: string): EventDerivedTeamReport {
  const team = report.teams[teamId];
  if (!team) throw new Error(`Missing event-derived report for team ${teamId}`);
  return team;
}

function round(value: number, decimals: number): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

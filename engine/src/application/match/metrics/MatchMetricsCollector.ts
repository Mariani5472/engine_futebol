import { MatchEvent, ShotResult } from "../../../domain";
import { MatchState } from "../../../core/movement/MatchState";
import { DecisionType } from "../decision/DecisionType";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { buildMatchMetrics, MatchMetrics } from "./MatchMetrics";
import { TeamMatchMetrics } from "./TeamMatchMetrics";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";
import { TacticalDiagnosticsCollector } from "../diagnostics/TacticalDiagnosticsCollector";
import type { MatchTacticalDiagnostics } from "../diagnostics/TacticalDiagnosticsCollector";

interface MutableTeamStats {
  goals: number;
  shots: number;
  shotsOnTarget: number;
  shotsOffTarget: number;
  shotsBlocked: number;
  shotsSaved: number;
  xG: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  corners: number;
  passes: number;
  progressivePasses: number;
  crosses: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  highPressRecoveries: number;
  attacks: number;
  shotDistanceSum: number;
  possessionSamples: number;
  attackingThirdSamples: number;
  opponentPassesWhileDefending: number;
  defensiveActions: number;
  attackActive: boolean;
}

function createMutable(): MutableTeamStats {
  return {
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    shotsOffTarget: 0,
    shotsBlocked: 0,
    shotsSaved: 0,
    xG: 0,
    yellowCards: 0,
    redCards: 0,
    fouls: 0,
    corners: 0,
    passes: 0,
    progressivePasses: 0,
    crosses: 0,
    tackles: 0,
    interceptions: 0,
    clearances: 0,
    highPressRecoveries: 0,
    attacks: 0,
    shotDistanceSum: 0,
    possessionSamples: 0,
    attackingThirdSamples: 0,
    opponentPassesWhileDefending: 0,
    defensiveActions: 0,
    attackActive: false,
  };
}

/**
 * @deprecated The running engine derives football statistics exclusively from
 * MatchEventStore. Kept temporarily for consumers that instantiate it directly.
 */
export class MatchMetricsCollector {
  private readonly tactical = new TacticalDiagnosticsCollector();
  private readonly home = createMutable();
  private readonly away = createMutable();
  private homeTeamId: string | null = null;
  private awayTeamId: string | null = null;
  private lastOwnerId: string | null = null;
  private lastOwnerIsHome: boolean | null = null;

  public bindTeams(homeTeamId: string, awayTeamId: string): void {
    this.homeTeamId = homeTeamId;
    this.awayTeamId = awayTeamId;
  }

  public onEvents(events: readonly MatchEvent[], state: MatchState): void {
    if (!this.homeTeamId) {
      this.bindTeams(state.home.team.id, state.away.team.id);
    }

    for (const event of events) {
      switch (event.type) {
        case "SHOT":
          this.handleShot(event.teamId, event.playerId, event.result, state);
          break;
        case "GOAL":
          this.handleGoal(event.teamId);
          break;
        case "SHOT_ON_TARGET":
          this.statsForTeam(event.teamId)!.shotsOnTarget++;
          break;
        case "SHOT_OFF_TARGET":
        case "WOODWORK":
          this.statsForTeam(event.teamId)!.shotsOffTarget++;
          break;
        case "SHOT_BLOCKED":
          this.statsForTeam(event.teamId)!.shotsBlocked++;
          break;
        case "GOALKEEPER_SAVE": {
          const shooterIsHome = state.home.players.some(player => player.player.id === event.shooterId);
          (shooterIsHome ? this.home : this.away).shotsSaved++;
          break;
        }
        case "CARD":
          this.handleCard(event.teamId, event.cardType);
          break;
        case "CORNER":
          this.handleCorner(event.teamId);
          break;
        case "FOUL":
          this.handleFoul(event.teamId);
          break;
        default:
          break;
      }
    }
  }

  public onActionStarted(
    player: PlayerMatchState,
    type: DecisionType,
    state: MatchState,
  ): void {
    this.tactical.onActionStarted(player, type, state);
    const isHome = state.home.players.includes(player);
    const stats = isHome ? this.home : this.away;
    const opp = isHome ? this.away : this.home;

    switch (type) {
      case DecisionType.PASS: {
        stats.passes++;
        opp.opponentPassesWhileDefending++;
        if (this.isProgressivePass(player, state, isHome)) {
          stats.progressivePasses++;
        }
        break;
      }
      case DecisionType.CROSS:
        stats.crosses++;
        stats.passes++;
        opp.opponentPassesWhileDefending++;
        break;
      case DecisionType.TACKLE:
        stats.tackles++;
        stats.defensiveActions++;
        break;
      case DecisionType.INTERCEPT:
        stats.interceptions++;
        stats.defensiveActions++;
        break;
      case DecisionType.CLEAR:
        stats.clearances++;
        stats.defensiveActions++;
        break;
      case DecisionType.BLOCK:
        stats.defensiveActions++;
        break;
      default:
        break;
    }
  }

  public sampleState(state: MatchState, deltaTime = .05): void {
    this.tactical.sample(state, deltaTime);
    if (!this.homeTeamId) {
      this.bindTeams(state.home.team.id, state.away.team.id);
    }

    const owner = state.ball.owner;
    if (!owner) {
      this.lastOwnerId = null;
      this.lastOwnerIsHome = null;
      return;
    }

    const isHome = state.home.players.includes(owner);
    const stats = isHome ? this.home : this.away;
    const pitchLength = state.pitch.length;
    const attackingDirection = isHome
      ? state.home.attackingDirection
      : state.away.attackingDirection;

    stats.possessionSamples++;

    if (this.isInAttackingThird(owner.position.x, attackingDirection, pitchLength)) {
      stats.attackingThirdSamples++;
      if (!stats.attackActive) {
        stats.attackActive = true;
        stats.attacks++;
      }
    }

    if (
      this.lastOwnerId !== null &&
      this.lastOwnerIsHome !== null &&
      this.lastOwnerIsHome !== isHome &&
      owner.player.id !== this.lastOwnerId
    ) {
      if (this.isInAttackingThird(owner.position.x, attackingDirection, pitchLength)) {
        stats.highPressRecoveries++;
      }
      const prev = this.lastOwnerIsHome ? this.home : this.away;
      prev.attackActive = false;
    }

    this.lastOwnerId = owner.player.id;
    this.lastOwnerIsHome = isHome;
  }

  public finalize(): MatchMetrics {
    return buildMatchMetrics(
      this.toTeamMetrics(this.home),
      this.toTeamMetrics(this.away),
      this.tactical.snapshot(),
    );
  }

  public tacticalSnapshot(): MatchTacticalDiagnostics {
    return this.tactical.snapshot();
  }

  private handleShot(
    teamId: string,
    playerId: string,
    result: ShotResult,
    state: MatchState,
  ): void {
    const stats = this.statsForTeam(teamId);
    if (!stats) return;

    stats.shots++;

    switch (result) {
      case "IN_FLIGHT":
        break;
      case "GOAL":
        stats.shotsOnTarget++;
        break;
      case "SAVED":
        stats.shotsOnTarget++;
        stats.shotsSaved++;
        break;
      case "BLOCKED":
        stats.shotsBlocked++;
        break;
      case "OFF_TARGET":
        stats.shotsOffTarget++;
        break;
    }

    const distance = this.estimateShotDistance(teamId, playerId, state);
    stats.shotDistanceSum += distance;
    stats.xG += this.estimateXG(distance);
  }

  private handleGoal(teamId: string): void {
    const stats = this.statsForTeam(teamId);
    if (!stats) return;
    stats.goals++;
    stats.attackActive = false;
  }

  private handleCard(teamId: string, cardType: "YELLOW" | "RED"): void {
    const stats = this.statsForTeam(teamId);
    if (!stats) return;

    if (cardType === "YELLOW") stats.yellowCards++;
    else stats.redCards++;
  }

  private handleCorner(teamId: string): void {
    const stats = this.statsForTeam(teamId);
    if (!stats) return;
    stats.corners++;
  }

  private handleFoul(teamId: string): void {
    const stats = this.statsForTeam(teamId);
    if (!stats) return;
    stats.fouls++;
  }

  private statsForTeam(teamId: string): MutableTeamStats | null {
    if (teamId === this.homeTeamId) return this.home;
    if (teamId === this.awayTeamId) return this.away;
    return null;
  }

  private estimateShotDistance(
    teamId: string,
    playerId: string,
    state: MatchState,
  ): number {
    const isHome = teamId === this.homeTeamId;
    const team = isHome ? state.home : state.away;
    const shooter = team.players.find((p) => p.player.id === playerId);

    const goalX = team.attackingDirection === 1 ? state.pitch.length : 0;
    const goalY = state.pitch.width / 2;
    const pos = shooter?.position ?? state.ball.position;

    return Math.hypot(pos.x - goalX, pos.y - goalY);
  }

  private estimateXG(distance: number): number {
    let base: number;
    if (distance <= 6) base = 0.35;
    else if (distance <= 12) base = 0.18;
    else if (distance <= 18) base = 0.09;
    else if (distance <= 25) base = 0.04;
    else if (distance <= 35) base = 0.02;
    else base = 0.01;

    return base * ENGINE_CALIBRATION_PARAMETERS.metrics.xGScale;
  }

  private isInAttackingThird(
    x: number,
    attackingDirection: 1 | -1,
    pitchLength: number,
  ): boolean {
    const third = pitchLength / 3;
    if (attackingDirection === 1) return x >= pitchLength - third;
    return x <= third;
  }

  private isProgressivePass(
    player: PlayerMatchState,
    state: MatchState,
    isHome: boolean,
  ): boolean {
    const attackingDirection = isHome
      ? state.home.attackingDirection
      : state.away.attackingDirection;
    const mid = state.pitch.length / 2;
    const x = player.position.x;

    if (attackingDirection === 1) return x < mid + 15;
    return x > mid - 15;
  }

  private toTeamMetrics(s: MutableTeamStats): TeamMatchMetrics {
    const totalPossession =
      this.home.possessionSamples + this.away.possessionSamples;
    const possessionPercent =
      totalPossession > 0
        ? (s.possessionSamples / totalPossession) * 100
        : 50;

    const totalAttackSamples =
      this.home.attackingThirdSamples + this.away.attackingThirdSamples;
    const fieldTiltPercent =
      totalAttackSamples > 0
        ? (s.attackingThirdSamples / totalAttackSamples) * 100
        : 50;

    const ppda =
      s.defensiveActions > 0
        ? s.opponentPassesWhileDefending / s.defensiveActions
        : Number.POSITIVE_INFINITY;

    return {
      goals: s.goals,
      shots: s.shots,
      shotsOnTarget: s.shotsOnTarget,
      shotsOffTarget: s.shotsOffTarget,
      shotsBlocked: s.shotsBlocked,
      shotsSaved: s.shotsSaved,
      xG: Math.round(s.xG * 100) / 100,
      yellowCards: s.yellowCards,
      redCards: s.redCards,
      fouls: s.fouls,
      corners: s.corners,
      passes: s.passes,
      progressivePasses: s.progressivePasses,
      crosses: s.crosses,
      tackles: s.tackles,
      interceptions: s.interceptions,
      clearances: s.clearances,
      highPressRecoveries: s.highPressRecoveries,
      attacks: s.attacks,
      averageShotDistance:
        s.shots > 0
          ? Math.round((s.shotDistanceSum / s.shots) * 10) / 10
          : 0,
      possessionPercent: Math.round(possessionPercent * 10) / 10,
      fieldTiltPercent: Math.round(fieldTiltPercent * 10) / 10,
      ppda: Number.isFinite(ppda) ? Math.round(ppda * 10) / 10 : ppda,
    };
  }
}

import type { MatchState } from "../../../../core/movement/MatchState";
import type { TeamMatchState } from "../../../../core/movement/TeamMatchState";
import { PlayerIntentSystem } from "./PlayerIntentSystem";
import { SpaceAnalysisSystem } from "./SpaceAnalysisSystem";
import { SpatioTemporalSystem } from "./SpatioTemporalSystem";
import { TacticalPatternDetector } from "./TacticalPatternDetector";
import type {
  DecisionTacticalPhase, PlayerSpatioTemporalState, TacticalIntelligenceSnapshot,
  TacticalReservation, TeamTacticalContext,
} from "./TacticalIntelligenceTypes";
import { CombinationPlaySystem } from "./CombinationPlaySystem";

interface PhaseCandidate { readonly phase: DecisionTacticalPhase; readonly since: number }

/** Creates the immutable shared tactical frame consumed by every decision in a cognitive cycle. */
export class TacticalIntelligenceSystem {
  private readonly spatial = new SpatioTemporalSystem();
  private readonly spaces = new SpaceAnalysisSystem();
  private readonly patterns = new TacticalPatternDetector();
  private readonly combinations = new CombinationPlaySystem();
  public readonly intents = new PlayerIntentSystem();
  private readonly committedPhases = new Map<string, DecisionTacticalPhase>();
  private readonly candidates = new Map<string, PhaseCandidate>();
  private snapshotValue: TacticalIntelligenceSnapshot = { generatedAt: 0, players: new Map(), teams: new Map() };

  public update(match: MatchState): TacticalIntelligenceSnapshot {
    this.intents.update(match);
    for (const player of [...match.home.players, ...match.away.players]) this.intents.inferFromResponsibility(match, player);
    const players = this.spatial.update(match);
    const teams = new Map<string, TeamTacticalContext>();
    for (const team of [match.home, match.away]) teams.set(team.team.id, this.buildTeam(match, team, players));
    this.snapshotValue = { generatedAt: match.currentSecond, players, teams };
    return this.snapshotValue;
  }

  public snapshot(): TacticalIntelligenceSnapshot { return this.snapshotValue; }

  private buildTeam(
    match: MatchState,
    team: TeamMatchState,
    players: ReadonlyMap<string, PlayerSpatioTemporalState>,
  ): TeamTacticalContext {
    const analysis = this.spaces.analyze(match, team, players);
    const phase = this.stablePhase(match, team);
    const occupancy: Record<string, number> = {};
    for (const player of team.players) {
      const progress = (team.attackingDirection === 1 ? player.position.x : match.pitch.length - player.position.x) / match.pitch.length;
      const side = player.position.y < match.pitch.width / 3 ? "left" : player.position.y > match.pitch.width * 2 / 3 ? "right" : "centre";
      const band = progress < .33 ? "own" : progress < .67 ? "middle" : "final";
      occupancy[`${band}:${side}`] = (occupancy[`${band}:${side}`] ?? 0) + 1;
    }
    const overloadedZones = Object.entries(occupancy).filter(([, count]) => count >= 4).map(([zone]) => zone);
    const vulnerableZones = analysis.spaces.filter(space => space.kind === "turnoverDanger" && space.occupationRisk > .55).map(space => space.id);
    const behindBall = team.players.filter(player => (match.ball.position.x - player.position.x) * team.attackingDirection > 0);
    const coverPlayers = behindBall.filter(player => String(player.currentRole).includes("BACK") || String(player.currentRole).includes("DEFENSIVE"));
    const reservations = this.reservations(match, team);
    const patterns = this.patterns.detect(match, team, players, analysis.spaces);
    const combinations = this.combinations.detect(match, team, analysis.passingLanes);
    return {
      teamId: team.team.id,
      currentPhase: phase,
      possessionState: team.possessionState,
      possessionConfidence: team.possessionPrediction.likelyTeamId === team.team.id ? team.possessionPrediction.confidence : 1 - team.possessionPrediction.confidence,
      occupiedZones: occupancy,
      overloadedZones,
      vulnerableZones,
      spaces: analysis.spaces,
      passingLanes: analysis.passingLanes,
      runningLanes: analysis.runningLanes,
      progressionRoutes: analysis.passingLanes.filter(lane => lane.progression > 5 && lane.clearAtArrival)
        .sort((a,b) => b.progression + b.arrivalMargin * 4 - a.progression - a.arrivalMargin * 4).slice(0, 12),
      defensiveCover: { playersBehindBall: behindBall.length, compactness: this.compactness(team) },
      restDefense: { protected: coverPlayers.length >= 3, coveringPlayerIds: coverPlayers.map(player => player.player.id) },
      activeTacticalPatterns: patterns,
      reservations,
      combinations,
    };
  }

  private stablePhase(match: MatchState, team: TeamMatchState): DecisionTacticalPhase {
    const raw = this.rawPhase(match, team);
    const committed = this.committedPhases.get(team.team.id);
    if (!committed || raw === "restart" || (match.ball.owner && raw !== committed)) {
      this.committedPhases.set(team.team.id, raw); this.candidates.delete(team.team.id); return raw;
    }
    if (committed === raw) { this.candidates.delete(team.team.id); return committed; }
    const candidate = this.candidates.get(team.team.id);
    if (!candidate || candidate.phase !== raw) {
      this.candidates.set(team.team.id, { phase: raw, since: match.currentSecond });
      return committed;
    }
    if (match.currentSecond - candidate.since >= .25) {
      this.committedPhases.set(team.team.id, raw); this.candidates.delete(team.team.id); return raw;
    }
    return committed;
  }

  private rawPhase(match: MatchState, team: TeamMatchState): DecisionTacticalPhase {
    if (match.kickoff || match.restart || match.pendingGoalRestart) return "restart";
    if (match.ball.owner) {
      const owns = team.players.includes(match.ball.owner);
      if (owns) return team.collectivePhase === "ATTACKING_TRANSITION" || team.collectivePhase === "COUNTER_ATTACK" ? "attackingTransition" : "establishedAttack";
      return team.collectivePhase === "DEFENSIVE_TRANSITION" ? "defensiveTransition" : "establishedDefense";
    }
    const prediction = team.possessionPrediction;
    if (prediction.state === "contested" || prediction.confidence < .58) return "contestedBall";
    const favoured = prediction.likelyTeamId === team.team.id;
    if (favoured && match.ball.motion && (match.ball.pendingPass || match.ball.intendedReceiverId)) return "offensiveBallFlight";
    if (favoured) return "attackingTransition";
    return "defensiveTransition";
  }

  private reservations(match: MatchState, team: TeamMatchState): TacticalReservation[] {
    const result: TacticalReservation[] = [];
    for (const player of team.players) {
      const intent = player.intent;
      if (!intent?.targetPosition || intent.expiresAt <= match.currentSecond) continue;
      const type: TacticalReservation["type"] = intent.type === "provideWidth" ? "provideWidth"
        : intent.type === "counterpress" ? "pressTarget"
        : intent.type === "protectZone" ? "coverZone"
        : intent.type === "attackSpace" || intent.type === "thirdManRun" || intent.type === "completeOneTwo" ? "attackSpace"
        : "occupyZone";
      result.push({ playerId: player.player.id, type, target: intent.targetPosition, priority: intent.commitment, expiresAt: intent.expiresAt });
    }
    return result.sort((a,b) => b.priority - a.priority);
  }

  private compactness(team: TeamMatchState): number {
    if (!team.players.length) return 1;
    const xs = team.players.map(player => player.position.x);
    const ys = team.players.map(player => player.position.y);
    const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    return Math.max(0, Math.min(1, 1 - area / 4500));
  }
}

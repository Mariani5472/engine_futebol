import type { MatchState } from "../../../core/movement/MatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import type { TacticalPhase } from "../../../domain";
import type { MatchEvent } from "../../../domain";

const TRANSITION_SECONDS = 4;
const SET_PIECE_SECONDS = 3;

/** Owns the phase state machine for both teams. */
export class CollectivePhaseSystem {
  private previousPossessionTeamId: string | null = null;

  public update(state: MatchState, events: readonly MatchEvent[] = []): void {
    const ownerTeam = state.ball.owner
      ? (state.home.players.includes(state.ball.owner) ? state.home : state.away)
      : null;
    const ownerId = ownerTeam?.team.id ?? null;
    const possessionChanged = ownerId !== this.previousPossessionTeamId;

    const corner = events.find(event => event.type === "CORNER");
    const foul = events.find(event => event.type === "FOUL");
    if (corner || foul) {
      const awardedTeamId = corner?.teamId ?? this.opponentOf(state, foul!.teamId).team.id;
      const awarded = state.home.team.id === awardedTeamId ? state.home : state.away;
      const defending = awarded === state.home ? state.away : state.home;
      this.enter(awarded, "SET_PIECE", state.currentSecond);
      this.enter(defending, "DEFENSIVE_BLOCK", state.currentSecond);
      this.previousPossessionTeamId = ownerId;
      return;
    }

    if (possessionChanged && ownerTeam) {
      const defending = ownerTeam === state.home ? state.away : state.home;
      this.enter(ownerTeam, this.hasCounterSpace(state, ownerTeam) ? "COUNTER_ATTACK" : "ATTACKING_TRANSITION", state.currentSecond);
      this.enter(defending, "DEFENSIVE_TRANSITION", state.currentSecond);
    }

    this.resolveStablePhase(state, state.home, ownerTeam === state.home);
    this.resolveStablePhase(state, state.away, ownerTeam === state.away);
    this.previousPossessionTeamId = ownerId;
  }

  private resolveStablePhase(state: MatchState, team: TeamMatchState, hasPossession: boolean): void {
    const elapsed = state.currentSecond - team.collectivePhaseSince;
    if (team.collectivePhase === "SET_PIECE" && elapsed < SET_PIECE_SECONDS) return;
    if (hasPossession) {
      if ((team.collectivePhase === "ATTACKING_TRANSITION" || team.collectivePhase === "COUNTER_ATTACK") && elapsed < TRANSITION_SECONDS) return;
      const progress = this.attackingProgress(state, team);
      this.enter(team, progress < .34 ? "BUILD_UP" : progress < .67 ? "PROGRESSION" : "FINAL_THIRD", state.currentSecond);
      return;
    }
    if (team.collectivePhase === "DEFENSIVE_TRANSITION" && elapsed < TRANSITION_SECONDS) return;
    this.enter(team, "DEFENSIVE_BLOCK", state.currentSecond);
  }

  private opponentOf(state: MatchState, teamId: string): TeamMatchState {
    return state.home.team.id === teamId ? state.away : state.home;
  }

  private hasCounterSpace(state: MatchState, team: TeamMatchState): boolean {
    if (!team.tactic.teamInstructions.instructions.includes("COUNTER_ATTACK")) return false;
    const opponents = team === state.home ? state.away.players : state.home.players;
    const ballX = state.ball.position.x;
    const goalSide = opponents.filter(player => team.attackingDirection === 1 ? player.position.x > ballX : player.position.x < ballX);
    return goalSide.length <= 6;
  }

  private attackingProgress(state: MatchState, team: TeamMatchState): number {
    const normalized = state.ball.position.x / state.pitch.length;
    return team.attackingDirection === 1 ? normalized : 1 - normalized;
  }

  private enter(team: TeamMatchState, phase: TacticalPhase, second: number): void {
    if (team.collectivePhase === phase) return;
    team.collectivePhase = phase;
    team.collectivePhaseSince = second;
  }
}

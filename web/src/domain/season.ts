import { simulateMatch, type Formation, type MatchResult, type Player, type Team } from "@match-engine/core";

export type Fixture = { id: string; round: number; homeTeamId: string; awayTeamId: string; status: "SCHEDULED" | "PLAYED"; result?: MatchResult };
export type Standing = { teamId: string; played: number; points: number; wins: number; draws: number; losses: number; goalsFor: number; goalsAgainst: number; goalDifference: number };
export type PlayerSeasonStats = { playerId: string; teamId: string; appearances: number; goals: number; shots: number; minutes: number; ratingTotal: number; ratings: number };
export type SeasonState = { id: string; round: number; userTeamId: string; teams: Team[]; fixtures: Fixture[]; standings: Standing[]; playerStats: PlayerSeasonStats[]; status: "NOT_STARTED" | "IN_PROGRESS" | "FINISHED" };

export const formationSlots: Record<Formation, Record<Player["position"], number>> = {
  "4-4-2": { GK: 1, DEF: 4, MID: 4, FWD: 2 },
  "4-3-3": { GK: 1, DEF: 4, MID: 3, FWD: 3 },
  "4-2-3-1": { GK: 1, DEF: 4, MID: 5, FWD: 1 },
  "3-5-2": { GK: 1, DEF: 3, MID: 5, FWD: 2 },
};

const hash = (value: string): number => {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
};

export function generateFixtures(teamIds: string[]): Fixture[] {
  if (teamIds.length < 2 || teamIds.length % 2 !== 0) throw new Error("Fixture generation requires an even number of at least two teams.");
  const rotation = [...teamIds];
  const firstLeg: Fixture[] = [];
  for (let round = 1; round < teamIds.length; round += 1) {
    for (let index = 0; index < teamIds.length / 2; index += 1) {
      const left = rotation[index];
      const right = rotation[rotation.length - 1 - index];
      const [homeTeamId, awayTeamId] = (round + index) % 2 === 0 ? [right, left] : [left, right];
      firstLeg.push({ id: `r${round}-${homeTeamId}-${awayTeamId}`, round, homeTeamId, awayTeamId, status: "SCHEDULED" });
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return [...firstLeg, ...firstLeg.map((fixture) => ({ ...fixture, id: `r${fixture.round + teamIds.length - 1}-${fixture.awayTeamId}-${fixture.homeTeamId}`, round: fixture.round + teamIds.length - 1, homeTeamId: fixture.awayTeamId, awayTeamId: fixture.homeTeamId }))];
}

export function createSeason(teams: Team[], userTeamId: string): SeasonState {
  return { id: "season-2026", round: 1, userTeamId, teams, fixtures: generateFixtures(teams.map((team) => team.id)), standings: updateStandings([], teams), playerStats: [], status: "NOT_STARTED" };
}

export function selectBestLineup(team: Team): Team {
  const slots = formationSlots[team.formation];
  const starters: Player[] = [];
  for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
    starters.push(...team.players.filter((player) => player.position === position).sort((a, b) => rating(b) - rating(a)).slice(0, slots[position]));
  }
  const starterIds = new Set(starters.map((player) => player.id));
  return { ...team, players: [...starters, ...team.players.filter((player) => !starterIds.has(player.id))] };
}

const rating = (player: Player) => player.attributes.mental + player.attributes.physical + player.attributes.technical;

export function applyLineup(team: Team, formation: Formation, starterIds: string[]): Team {
  const slots = formationSlots[formation];
  if (starterIds.length !== 11 || new Set(starterIds).size !== 11) throw new Error("A lineup must have exactly 11 unique starters.");
  const starters = starterIds.map((id) => team.players.find((player) => player.id === id)).filter((player): player is Player => Boolean(player));
  for (const position of ["GK", "DEF", "MID", "FWD"] as const) {
    if (starters.filter((player) => player.position === position).length !== slots[position]) throw new Error(`The ${formation} formation needs ${slots[position]} ${position} players.`);
  }
  const chosen = new Set(starterIds);
  return { ...team, formation, players: [...starters, ...team.players.filter((player) => !chosen.has(player.id))] };
}

export function simulateRound(season: SeasonState): SeasonState {
  if (season.status === "FINISHED") return season;
  const fixtures = season.fixtures.map((fixture) => {
    if (fixture.round !== season.round || fixture.status === "PLAYED") return fixture;
    const home = season.teams.find((team) => team.id === fixture.homeTeamId)!;
    const away = season.teams.find((team) => team.id === fixture.awayTeamId)!;
    const homeTeam = home.id === season.userTeamId ? home : selectBestLineup(home);
    const awayTeam = away.id === season.userTeamId ? away : selectBestLineup(away);
    return { ...fixture, status: "PLAYED" as const, result: simulateMatch({ homeTeam, awayTeam, seed: hash(`${season.id}:${fixture.round}:${fixture.homeTeamId}:${fixture.awayTeamId}`) }) };
  });
  const completed = fixtures.every((fixture) => fixture.status === "PLAYED");
  return { ...season, fixtures, standings: updateStandings(fixtures, season.teams), playerStats: updatePlayerStats(fixtures), round: completed ? season.round : season.round + 1, status: completed ? "FINISHED" : "IN_PROGRESS" };
}

export function updateStandings(fixtures: Fixture[], teams: Team[]): Standing[] {
  const table = new Map(teams.map((team) => [team.id, { teamId: team.id, played: 0, points: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0 }]));
  for (const fixture of fixtures) {
    if (!fixture.result) continue;
    const home = table.get(fixture.homeTeamId)!; const away = table.get(fixture.awayTeamId)!;
    const { home: homeGoals, away: awayGoals } = fixture.result.score;
    home.played += 1; away.played += 1; home.goalsFor += homeGoals; home.goalsAgainst += awayGoals; away.goalsFor += awayGoals; away.goalsAgainst += homeGoals;
    if (homeGoals > awayGoals) { home.wins += 1; home.points += 3; away.losses += 1; }
    else if (homeGoals < awayGoals) { away.wins += 1; away.points += 3; home.losses += 1; }
    else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1; }
  }
  return [...table.values()].map((entry) => ({ ...entry, goalDifference: entry.goalsFor - entry.goalsAgainst })).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || b.wins - a.wins || a.teamId.localeCompare(b.teamId));
}

export function updatePlayerStats(fixtures: Fixture[]): PlayerSeasonStats[] {
  const stats = new Map<string, PlayerSeasonStats>();
  for (const fixture of fixtures) {
    if (!fixture.result) continue;
    for (const teamState of [fixture.result.finalState.homeTeam, fixture.result.finalState.awayTeam]) {
      for (const player of teamState.players) {
        const entry = stats.get(player.playerId) ?? { playerId: player.playerId, teamId: teamState.teamId, appearances: 0, goals: 0, shots: 0, minutes: 0, ratingTotal: 0, ratings: 0 };
        entry.goals += player.goals; entry.shots += player.shots; entry.minutes += player.minutesPlayed;
        if (player.minutesPlayed > 0) { entry.appearances += 1; entry.ratingTotal += player.rating; entry.ratings += 1; }
        stats.set(player.playerId, entry);
      }
    }
  }
  return [...stats.values()];
}

export const isSeasonFinished = (season: SeasonState) => season.fixtures.every((fixture) => fixture.status === "PLAYED");
export const getChampion = (season: SeasonState) => isSeasonFinished(season) ? season.standings[0]?.teamId : undefined;

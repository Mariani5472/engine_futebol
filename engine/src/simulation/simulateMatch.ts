import type { DebugEntry, MatchEvent, MatchResult, Player, PlayerMatchState, Score, SimulateMatchInput, Team, TeamState } from "../domain.js";
import { Random } from "../random/Random.js";
import { calculateTeamAttack, calculateTeamDefense, calculateTeamMidfield } from "./calculateTeamStrength.js";

type MutablePlayerState = PlayerMatchState & { player: Player };
type MutableTeamState = { team: Team; players: MutablePlayerState[]; stats: { shots: number; shotsOnTarget: number; goals: number; yellowCards: number; corners: number } };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function validateTeam(team: Team, otherTeamId: string): void {
  if (!team.id.trim() || !team.name.trim()) throw new Error("Every team needs a non-empty id and name.");
  if (team.id === otherTeamId) throw new Error("homeTeam and awayTeam must have different ids.");
  if (team.players.length < 11) throw new Error(`${team.name} must provide at least 11 players.`);
  const ids = new Set<string>();
  for (const player of team.players) {
    if (!player.id.trim() || !player.name.trim() || ids.has(player.id)) throw new Error(`${team.name} has an invalid or duplicate player id.`);
    ids.add(player.id);
    for (const value of Object.values(player.attributes)) {
      if (!Number.isInteger(value) || value < 1 || value > 20) throw new Error(`${player.name} attributes must be integers from 1 to 20.`);
    }
  }
}

function createTeamState(team: Team): MutableTeamState {
  return {
    team,
    players: team.players.map((player, index) => ({
      player,
      playerId: player.id,
      status: index < 11 ? "STARTER" : "BENCH",
      minutesPlayed: 0,
      goals: 0,
      shots: 0,
      yellowCards: 0,
      rating: 6,
    })),
    stats: { shots: 0, shotsOnTarget: 0, goals: 0, yellowCards: 0, corners: 0 },
  };
}

function activePlayers(state: MutableTeamState): MutablePlayerState[] {
  return state.players.filter((player) => player.status === "STARTER");
}

function chooseShooter(state: MutableTeamState, random: Random): MutablePlayerState {
  const players = activePlayers(state);
  const weights = players.map((entry) => entry.player.attributes.technical + entry.player.attributes.mental * 0.5 + (entry.player.position === "FWD" ? 8 : entry.player.position === "MID" ? 4 : 1));
  const target = random.next() * weights.reduce((total, weight) => total + weight, 0);
  let total = 0;
  for (let index = 0; index < players.length; index += 1) {
    total += weights[index];
    if (target < total) return players[index];
  }
  return players[players.length - 1];
}

function pickTeam(home: MutableTeamState, away: MutableTeamState, homePossession: number, homeAdvantage: number, random: Random): [MutableTeamState, MutableTeamState] {
  const homeWeight = homePossession * homeAdvantage;
  return random.next() < homeWeight / (homeWeight + (100 - homePossession)) ? [home, away] : [away, home];
}

function publicTeamState(state: MutableTeamState): TeamState {
  return { teamId: state.team.id, players: state.players.map(({ player: _player, ...entry }) => entry) };
}

function calculateRating(entry: MutablePlayerState, won: boolean, drew: boolean, random: Random): number {
  const attributes = entry.player.attributes;
  const baseline = 5.8 + ((attributes.technical + attributes.mental + attributes.physical) / 3 - 10.5) * 0.07;
  const resultBonus = won ? 0.25 : drew ? 0 : -0.15;
  return Number(clamp(baseline + entry.goals * 1.35 + entry.shots * 0.06 - entry.yellowCards * 0.3 + resultBonus + (random.next() - 0.5) * 0.35, 1, 10).toFixed(1));
}

/** Simulates all ninety abstract minutes synchronously and deterministically. */
export function simulateMatch(input: SimulateMatchInput): MatchResult {
  validateTeam(input.homeTeam, input.awayTeam.id);
  validateTeam(input.awayTeam, input.homeTeam.id);
  const random = new Random(input.seed);
  const home = createTeamState(input.homeTeam);
  const away = createTeamState(input.awayTeam);
  const homeAdvantage = input.homeAdvantage ?? 1.05;
  if (!Number.isFinite(homeAdvantage) || homeAdvantage <= 0) throw new Error("homeAdvantage must be a positive finite number.");
  const midfieldTotal = calculateTeamMidfield(home.team) + calculateTeamMidfield(away.team);
  const homePossession = clamp(Math.round((calculateTeamMidfield(home.team) / midfieldTotal) * 100 + (random.next() - 0.5) * 6), 35, 65);
  const score: Score = { home: 0, away: 0 };
  const events: MatchEvent[] = [{ type: "MATCH_STARTED", minute: 0 }];
  const debug: DebugEntry[] = [];

  for (let minute = 1; minute <= 90; minute += 1) {
    for (const player of [...activePlayers(home), ...activePlayers(away)]) player.minutesPlayed += 1;

    if (random.chance(0.23)) {
      const [attacking, defending] = pickTeam(home, away, homePossession, homeAdvantage, random);
      const shooter = chooseShooter(attacking, random);
      const attackPower = shooter.player.attributes.technical + shooter.player.attributes.mental * 0.5 + shooter.player.attributes.physical * 0.25;
      const defensePower = calculateTeamDefense(defending.team);
      const advantage = clamp((attackPower - defensePower) / 20, -0.45, 0.45);
      const onTarget = random.chance(clamp(0.53 + advantage * 0.22, 0.38, 0.68));
      const outcome = onTarget
        ? random.chance(clamp(0.21 + advantage * 0.13, 0.1, 0.34)) ? "GOAL" : "SAVED"
        : random.chance(0.43) ? "BLOCKED" : "MISSED";
      attacking.stats.shots += 1;
      shooter.shots += 1;
      if (onTarget) attacking.stats.shotsOnTarget += 1;
      if (outcome === "GOAL") {
        attacking.stats.goals += 1;
        shooter.goals += 1;
        if (attacking === home) score.home += 1; else score.away += 1;
      }
      if (outcome === "BLOCKED" || (outcome === "MISSED" && random.chance(0.25)) || (outcome === "SAVED" && random.chance(0.12))) attacking.stats.corners += 1;
      events.push({ type: "SHOT", minute, teamId: attacking.team.id, playerId: shooter.playerId, outcome });
      if (input.debug) debug.push({ minute, type: "SHOT", teamId: attacking.team.id, playerId: shooter.playerId, attackPower: Number(attackPower.toFixed(2)), defensePower: Number(defensePower.toFixed(2)), outcome });
    }

    if (random.chance(0.035)) {
      const cardTeam = random.chance(0.5) ? home : away;
      const player = activePlayers(cardTeam)[random.int(0, 10)];
      player.yellowCards += 1;
      cardTeam.stats.yellowCards += 1;
      events.push({ type: "YELLOW_CARD", minute, teamId: cardTeam.team.id, playerId: player.playerId });
    }

    if (minute >= 60 && minute <= 82 && random.chance(0.14)) {
      const substitute = random.chance(0.5) ? home : away;
      const bench = substitute.players.filter((player) => player.status === "BENCH");
      if (bench.length > 0) {
        const outgoing = activePlayers(substitute)[random.int(0, 10)];
        const incoming = bench[random.int(0, bench.length - 1)];
        outgoing.status = "SUBSTITUTED";
        incoming.status = "STARTER";
        events.push({ type: "SUBSTITUTION", minute, teamId: substitute.team.id, playerInId: incoming.playerId, playerOutId: outgoing.playerId });
      }
    }

    if (minute === 45) events.push({ type: "HALF_TIME", minute: 45 });
  }

  events.push({ type: "MATCH_FINISHED", minute: 90 });
  for (const player of home.players) player.rating = calculateRating(player, score.home > score.away, score.home === score.away, random);
  for (const player of away.players) player.rating = calculateRating(player, score.away > score.home, score.home === score.away, random);
  const awayPossession = 100 - homePossession;

  return {
    score,
    events,
    statistics: {
      possession: { home: homePossession, away: awayPossession },
      shots: { home: home.stats.shots, away: away.stats.shots },
      shotsOnTarget: { home: home.stats.shotsOnTarget, away: away.stats.shotsOnTarget },
      goals: { home: score.home, away: score.away },
      yellowCards: { home: home.stats.yellowCards, away: away.stats.yellowCards },
      corners: { home: home.stats.corners, away: away.stats.corners },
    },
    finalState: { minute: 90, status: "FINISHED", homeTeam: publicTeamState(home), awayTeam: publicTeamState(away) },
    ...(input.debug ? { debug } : {}),
  };
}

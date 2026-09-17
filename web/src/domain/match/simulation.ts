import type { Athlete } from "@/domain/team/teams";
import type { DomainTeam } from "@/domain/team/types";
import {
  INITIAL_MATCH_STATS,
  type MatchEvent,
  type MatchSimulationState,
  type MatchStats,
} from "./types";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

function getStarters(team: DomainTeam, starterIds: string[]): Athlete[] {
  return team.athletes.filter((player) => starterIds.includes(player.id));
}

function getTeamStrength(team: DomainTeam, starterIds: string[]): number {
  const starters = getStarters(team, starterIds);
  if (starters.length === 0) return 60;

  return starters.reduce((sum, player) => sum + player.overall, 0) / starters.length;
}

function getOutfieldPlayers(team: DomainTeam, starterIds: string[]): Athlete[] {
  return getStarters(team, starterIds).filter((player) => player.position !== "G");
}

function getGoalkeepers(team: DomainTeam, starterIds: string[]): Athlete[] {
  return getStarters(team, starterIds).filter((player) => player.position === "G");
}

function getGoalChanceByPosition(player: Athlete): number {
  switch (player.position) {
    case "F":
      return 58;
    case "M":
      return 27;
    case "D":
      return 12;
    case "G":
      return 3;
    default:
      return 10;
  }
}

function ensureStats(stats?: MatchStats): MatchStats {
  return stats ? { ...stats } : { ...INITIAL_MATCH_STATS };
}

export function simulateMatchTick(
  state: MatchSimulationState,
  homeTeam: DomainTeam,
  awayTeam: DomainTeam,
  homeStarterIds: string[],
  awayStarterIds: string[],
): MatchSimulationState {
  if (state.minute >= 90) return state;

  const minute = state.minute + 1;
  const events: MatchEvent[] = [...state.events];
  const stats = ensureStats(state.stats);

  const homeStrength = getTeamStrength(homeTeam, homeStarterIds);
  const awayStrength = getTeamStrength(awayTeam, awayStarterIds);
  const totalStrength = Math.max(1, homeStrength + awayStrength);

  const homePossession = clamp(
    50 + (homeStrength - awayStrength) * 0.8 + 3,
    35,
    65,
  );
  stats.homePossession = Math.round(homePossession);
  stats.awayPossession = 100 - stats.homePossession;

  const pressure = Math.random();
  const eventChance = 0.09 + Math.abs(homeStrength - awayStrength) / 5000;

  if (pressure >= eventChance) {
    return { ...state, minute, stats };
  }

  const homeAttacks = Math.random() < homeStrength / totalStrength;
  const attackingTeam = homeAttacks ? homeTeam : awayTeam;
  const defendingTeam = homeAttacks ? awayTeam : homeTeam;
  const attackingIds = homeAttacks ? homeStarterIds : awayStarterIds;
  const defendingIds = homeAttacks ? awayStarterIds : homeStarterIds;
  const attackers = getOutfieldPlayers(attackingTeam, attackingIds);
  const goalkeepers = getGoalkeepers(defendingTeam, defendingIds);
  const player = pickRandom(attackers);

  if (!player) return { ...state, minute, stats };

  const teamId = attackingTeam.id;
  const isHome = homeAttacks;
  const goalkeeper = pickRandom(goalkeepers);

  if (Math.random() < 0.72) {
    if (isHome) stats.homeShots += 1;
    else stats.awayShots += 1;

    const shotOnTarget = Math.random() < 0.46;
    if (shotOnTarget) {
      if (isHome) stats.homeShotsOnTarget += 1;
      else stats.awayShotsOnTarget += 1;
    }

    const strengthFactor = clamp(player.overall / 100, 0.55, 0.98);
    const goalProbability = shotOnTarget
      ? 0.18 + (strengthFactor - 0.55) * 0.2
      : 0.035;

    if (Math.random() < goalProbability) {
      if (isHome) state = { ...state, homeScore: state.homeScore + 1 };
      else state = { ...state, awayScore: state.awayScore + 1 };

      events.push({
        minute,
        teamId,
        type: "goal",
        playerId: player.id,
        text: `GOOOL! ${player.name} marca para ${attackingTeam.name}.`,
      });
    } else if (shotOnTarget && goalkeeper) {
      events.push({
        minute,
        teamId: defendingTeam.id,
        type: "save",
        playerId: goalkeeper.id,
        text: `${goalkeeper.name} defende a finalização de ${player.name}.`,
      });
    } else {
      events.push({
        minute,
        teamId,
        type: "shot",
        playerId: player.id,
        text: `${player.name} finaliza para ${attackingTeam.name}.`,
      });
    }
  } else if (Math.random() < 0.45) {
    if (isHome) stats.homeFouls += 1;
    else stats.awayFouls += 1;

    events.push({
      minute,
      teamId: defendingTeam.id,
      type: "foul",
      playerId: player.id,
      text: `Falta cometida por ${player.name}.`,
    });
  } else {
    const cardChance = Math.random();
    if (cardChance < 0.16) {
      if (isHome) stats.homeYellowCards += 1;
      else stats.awayYellowCards += 1;

      events.push({
        minute,
        teamId,
        type: "yellow",
        playerId: player.id,
        text: `Cartão amarelo para ${player.name}.`,
      });
    } else {
      events.push({
        minute,
        teamId,
        type: "chance",
        playerId: player.id,
        text: `${player.name} cria uma boa oportunidade.`,
      });
    }
  }

  return {
    ...state,
    minute,
    events,
    stats,
  };
}

export function getExpectedGoalWeight(player: Athlete): number {
  return getGoalChanceByPosition(player) / 100;
}

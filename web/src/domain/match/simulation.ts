import type {
  Athlete,
  Team,
} from "@/domain/team/teams";

import type { MatchEvent } from "./types";

type SimulationState = {
  minute: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
};

function randomInt(min: number, max: number) {
  return Math.floor(
    Math.random() * (max - min + 1),
  ) + min;
}

function pick<T>(items: T[]) {
  return items[randomInt(0, items.length - 1)];
}

function pickWeighted<T>(
  items: T[],
  getWeight: (item: T) => number,
) {
  const totalWeight = items.reduce(
    (total, item) => total + getWeight(item),
    0,
  );

  if (totalWeight <= 0) {
    return pick(items);
  }

  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= getWeight(item);

    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

function getStartingPlayers(
  team: Team,
  starterIds: string[],
) {
  return team.athletes.filter((player) =>
    starterIds.includes(player.id),
  );
}

function getStartingOutfieldPlayers(
  team: Team,
  starterIds: string[],
) {
  return getStartingPlayers(
    team,
    starterIds,
  ).filter(
    (player) => player.position !== "G",
  );
}

function getStartingGoalkeepers(
  team: Team,
  starterIds: string[],
) {
  return getStartingPlayers(
    team,
    starterIds,
  ).filter(
    (player) => player.position === "G",
  );
}

function getGoalChanceByPosition(
  player: Athlete,
) {
  switch (player.position) {
    case "F":
      return 60;

    case "M":
      return 30;

    case "D":
      return 10;

    case "G":
      return 0;

    default:
      return 10;
  }
}

function getScorer(players: Athlete[]) {
  const outfieldPlayers = players.filter(
    (player) => player.position !== "G",
  );

  return pickWeighted(
    outfieldPlayers,
    getGoalChanceByPosition,
  );
}

function getGoalkeeper(players: Athlete[]) {
  const goalkeepers = players.filter(
    (player) => player.position === "G",
  );

  if (goalkeepers.length === 0) {
    return undefined;
  }

  return pick(goalkeepers);
}

export function simulateMatchTick(
  state: SimulationState,
  homeTeam: Team,
  awayTeam: Team,
  homeStarters: string[],
  awayStarters: string[],
): SimulationState {
  const nextMinute = Math.min(
    state.minute + 1,
    90,
  );

  const events = [...state.events];

  const homeOutfieldPlayers =
    getStartingOutfieldPlayers(
      homeTeam,
      homeStarters,
    );

  const awayOutfieldPlayers =
    getStartingOutfieldPlayers(
      awayTeam,
      awayStarters,
    );

  const homeGoalkeepers =
    getStartingGoalkeepers(
      homeTeam,
      homeStarters,
    );

  const awayGoalkeepers =
    getStartingGoalkeepers(
      awayTeam,
      awayStarters,
    );

  /*
   * Evento ofensivo.
   */
  if (Math.random() < 0.08) {
    const isHome = Math.random() < 0.5;

    const attackingTeam = isHome
      ? homeTeam
      : awayTeam;

    const attackingPlayers = isHome
      ? homeOutfieldPlayers
      : awayOutfieldPlayers;

    const defendingGoalkeepers = isHome
      ? awayGoalkeepers
      : homeGoalkeepers;

    if (attackingPlayers.length > 0) {
      const scorer = getScorer(
        attackingPlayers,
      );

      const goalkeeper =
        getGoalkeeper(
          defendingGoalkeepers,
        );

      /*
       * Aproximadamente 20% das
       * chances ofensivas terminam em gol.
       */
      const goal = Math.random() < 0.2;

      if (goal) {
        events.push({
          minute: nextMinute,
          teamId: attackingTeam.id,
          type: "goal",
          playerId: scorer.id,
          text:
            `GOOOL! ${scorer.shortName} marca ` +
            `para o ${attackingTeam.shortName}!`,
        });

        return {
          ...state,
          minute: nextMinute,
          homeScore:
            state.homeScore +
            (isHome ? 1 : 0),
          awayScore:
            state.awayScore +
            (isHome ? 0 : 1),
          events,
        };
      }

      const eventType =
        Math.random() < 0.5
          ? "shot"
          : "save";

      if (
        eventType === "shot" ||
        !goalkeeper
      ) {
        events.push({
          minute: nextMinute,
          teamId: attackingTeam.id,
          type: "shot",
          playerId: scorer.id,
          text:
            `${scorer.shortName} finaliza, ` +
            `mas a bola passa perto!`,
        });
      } else {
        events.push({
          minute: nextMinute,
          teamId: isHome
            ? awayTeam.id
            : homeTeam.id,
          type: "save",
          playerId: goalkeeper.id,
          text:
            `${goalkeeper.shortName} faz ` +
            `uma grande defesa!`,
        });
      }
    }
  }

  /*
   * Pequena chance de cartão.
   */
  if (Math.random() < 0.025) {
    const isHome = Math.random() < 0.5;

    const team = isHome
      ? homeTeam
      : awayTeam;

    const players = isHome
      ? homeOutfieldPlayers
      : awayOutfieldPlayers;

    if (players.length > 0) {
      const player = pick(players);

      events.push({
        minute: nextMinute,
        teamId: team.id,
        type: "yellow",
        playerId: player.id,
        text:
          `${player.shortName} recebe ` +
          `cartão amarelo.`,
      });
    }
  }

  return {
    ...state,
    minute: nextMinute,
    events,
  };
}
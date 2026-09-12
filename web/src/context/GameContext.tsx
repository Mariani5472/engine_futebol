import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  INITIAL_GAME_STATE,
  type GameState,
  type TacticalPosition,
} from "./GameState";
import { createFormationPositions } from "@/domain/tactic/formations";
import { getTeamById, teams } from "@/domain/team/teams";
import { generateFixtures } from "@/domain/season/fixtures";
import { calculateStandings, createInitialStandings } from "@/domain/season/standings";
import { getNextPlayerFixture } from "@/domain/match/nextMatch";
import { simulateMatchTick as runSimulationTick } from "@/domain/match/simulation";
import { simulateFixture } from "@/domain/match/autoSimulation";

type GameContextData = {
  gameState: GameState;
  setTeam: (teamId: string) => void;
  setFormation: (formation: GameState["tactic"]["formation"]) => void;
  setTacticalPositions: (positions: TacticalPosition[]) => void;
  setSquad: (starters: string[], bench: string[]) => void;
  setSeasonRound: (round: number) => void;
  getNextMatch: () => void;
  startMatch: () => void;
  simulateMatchTick: () => void;
  finishMatch: () => void;
  startGame: () => void;
  resetGame: () => void;
};

const GameContext = createContext<GameContextData | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);

  function setTeam(teamId: string) {
    const teamIds = teams.map((team) => team.id);

    const fixtures = generateFixtures(teamIds);

    const standings = calculateStandings(
      teamIds,
      fixtures,
      getTeamNames(),
    );

    const selectedTeam = getTeamById(teamId);

    const starters = selectedTeam
      ? getDefaultStarters(selectedTeam)
      : [];

    setGameState((current) => ({
      ...current,

      player: {
        ...current.player,
        teamId,
      },

      status: "playing",

      season: {
        ...current.season,
        year: 2026,
        currentRound: 1,
        fixtures,
        standings,
        playerStats: [],
      },

      squad: {
        starters,
        bench: selectedTeam
          ? selectedTeam.athletes
              .filter((player) => !starters.includes(player.id))
              .map((player) => player.id)
          : [],
      },

      tactic: {
        ...current.tactic,
        positions:
          starters.length === 11
            ? createFormationPositions(
                current.tactic.formation,
                starters,
              )
            : [],
      },
    }));
  }

  function setFormation(formation: GameState["tactic"]["formation"]) {
    setGameState((current) => ({
      ...current,
      tactic: {
        formation,
        positions: createFormationPositions(formation, current.squad.starters),
      },
    }));
  }

  function setTacticalPositions(positions: TacticalPosition[]) {
    setGameState((current) => ({ ...current, tactic: { ...current.tactic, positions } }));
  }

  function setSquad(starters: string[], bench: string[]) {
    setGameState((current) => ({
      ...current,
      squad: { starters, bench },
      tactic: {
        ...current.tactic,
        positions:
          current.tactic.positions.length === 0 && starters.length === 11
            ? createFormationPositions(current.tactic.formation, starters)
            : current.tactic.positions,
      },
    }));
  }

  function getDefaultStarters(
    team: ReturnType<typeof getTeamById>,
  ) {
    if (!team) return [];

    const goalkeeper =
      team.athletes.find(
        (player) =>
          player.position === "G",
      );

    const outfieldPlayers =
      team.athletes.filter(
        (player) =>
          player.position !== "G",
      );

    return [
      ...(goalkeeper
        ? [goalkeeper.id]
        : []),

      ...outfieldPlayers
        .slice(0, 10)
        .map(
          (player) => player.id,
        ),
    ];
  }

  function getNextMatch() {
    setGameState((current) => {
      if (!current.player.teamId) return current;

      if (
        current.match.phase === "pre-match" ||
        current.match.phase === "playing"
      ) {
        return current;
      }

      const fixture = getNextPlayerFixture(
        current.season.fixtures,
        current.player.teamId,
      );

      if (!fixture) return current;

      return {
        ...current,
        match: {
          fixtureId: fixture.id,
          phase: "pre-match",
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeScore: 0,
          awayScore: 0,
          minute: 0,
          events: [],
        },
      };
    });
  }
  
  function startMatch() {
    setGameState((current) => ({
      ...current,

      match: {
        ...current.match,
        phase: "playing",
      },
    }));
  }

  function simulateMatchTick() {
    setGameState((current) => {
      if (
        current.match.phase !== "playing" ||
        !current.match.homeTeamId ||
        !current.match.awayTeamId
      ) {
        return current;
      }

      const homeTeam = getTeamById(
        current.match.homeTeamId,
      );

      const awayTeam = getTeamById(
        current.match.awayTeamId,
      );

      if (!homeTeam || !awayTeam) {
        return current;
      }

      /*
      * Se for o time do jogador, usamos exatamente
      * os titulares definidos na tática.
      *
      * Para o adversário, usamos uma escalação
      * padrão temporária.
      */
      const homeStarters =
        homeTeam.id === current.player.teamId
          ? current.squad.starters
          : getDefaultStarters(homeTeam);

      const awayStarters =
        awayTeam.id === current.player.teamId
          ? current.squad.starters
          : getDefaultStarters(awayTeam);

      const result = runSimulationTick(
        {
          minute: current.match.minute,
          homeScore: current.match.homeScore,
          awayScore: current.match.awayScore,
          events: current.match.events,
        },
        homeTeam,
        awayTeam,
        homeStarters,
        awayStarters,
      );

      return {
        ...current,

        match: {
          ...current.match,

          minute: result.minute,

          homeScore: result.homeScore,
          awayScore: result.awayScore,

          events: result.events,
        },
      };
    });
  }

  function getTeamNames() {
    return Object.fromEntries(
      teams.map((team) => [
        team.id,
        team.name,
      ]),
    );
  }

  function setSeasonRound(round: number) {
    setGameState((current) => ({
      ...current,
      season: {
        ...current.season,
        currentRound: Math.max(1, Math.min(38, round)),
      },
    }));
  }

  function finishMatch() {
    setGameState((current) => {
      const fixtureId = current.match.fixtureId;

      if (!fixtureId) {
        return current;
      }

      /*
      * 1. Salva o resultado da partida do jogador.
      */
      let fixtures = current.season.fixtures.map(
        (fixture) =>
          fixture.id === fixtureId
            ? {
                ...fixture,
                result: {
                  homeScore: current.match.homeScore,
                  awayScore: current.match.awayScore,
                },
              }
            : fixture,
      );

      /*
      * 2. Descobre em qual rodada estamos.
      */
      const currentFixture = fixtures.find(
        (fixture) => fixture.id === fixtureId,
      );

      if (!currentFixture) {
        return current;
      }

      const currentRound =
        currentFixture.round;

      /*
      * 3. Simula instantaneamente todos os
      * outros jogos da mesma rodada.
      */
      fixtures = fixtures.map((fixture) => {
        if (
          fixture.round !== currentRound ||
          fixture.result !== null
        ) {
          return fixture;
        }

        return simulateFixture(fixture);
      });

      /*
      * 4. Recalcula a classificação.
      */
      const teamIds = teams.map(
        (team) => team.id,
      );

      const teamNames = Object.fromEntries(
        teams.map((team) => [
          team.id,
          team.name,
        ]),
      );

      const standings = calculateStandings(
        teamIds,
        fixtures,
        teamNames,
      );

      /*
      * 5. Descobre a próxima rodada.
      */
      

      return {
        ...current,

        season: {
          ...current.season,
          fixtures,
          standings,
        },

        match: {
          ...current.match,
          phase: "finished",
        },
      };
    });
  }

  function startGame() {
    setGameState((current) => ({ ...current, status: "playing" }));
  }

  function resetGame() {
    setGameState(INITIAL_GAME_STATE);
  }

  return (
    <GameContext.Provider 
      value={{
        gameState,

        setTeam,
        setFormation,
        setTacticalPositions,
        setSquad,
        setSeasonRound,

        getNextMatch,
        startMatch,
        simulateMatchTick,
        finishMatch,

        startGame,
        resetGame,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used inside GameProvider");
  return context;
}

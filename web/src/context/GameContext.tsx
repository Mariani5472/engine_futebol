import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  INITIAL_GAME_STATE,
  type GameState,
  type TacticalPosition,
} from "./GameState";
import { DEFAULT_PLAYER_STATUS } from "@/domain/player/status";
import { createFormationPositions } from "@/domain/tactic/formations";
import { buildInitialSquad } from "@/domain/tactic/squad";
import { getTeamById, getTeamIds, getTeamNames } from "@/domain/team/teams";
import { generateFixtures } from "@/domain/season/fixtures";
import { calculateStandings } from "@/domain/season/standings";
import { getNextPlayerFixture } from "@/domain/match/nextMatch";
import { simulateMatchTick as runSimulationTick } from "@/domain/match/simulation";
import { simulateFixture } from "@/domain/match/autoSimulation";
import { INITIAL_MATCH_STATS } from "@/domain/match/types";

const MAX_ROUND = 38;

function randomAddedTime(): number {
  return Math.floor(Math.random() * 5) + 2;
}

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

  const setTeam = useCallback((teamId: string) => {
    const selectedTeam = getTeamById(teamId);
    if (!selectedTeam) return;

    const teamIds = getTeamIds();
    const fixtures = generateFixtures(teamIds);
    const standings = calculateStandings(teamIds, fixtures, getTeamNames());
    const initialSquad = buildInitialSquad(selectedTeam.athletes);

    const statuses = Object.fromEntries(
      selectedTeam.athletes.map((player) => [
        player.id,
        { ...DEFAULT_PLAYER_STATUS },
      ]),
    );

    const positions =
      initialSquad.starters.length === 11
        ? createFormationPositions("4-3-3", initialSquad.starters)
        : [];

    setGameState({
      ...INITIAL_GAME_STATE,
      status: "playing",
      player: { teamId },
      season: {
        ...INITIAL_GAME_STATE.season,
        year: 2026,
        currentRound: 1,
        fixtures,
        standings,
        playerStats: [],
      },
      squad: {
        starters: initialSquad.starters,
        bench: initialSquad.bench,
        statuses,
      },
      tactic: {
        formation: "4-3-3",
        positions,
      },
    });
  }, []);

  const setFormation = useCallback(
    (formation: GameState["tactic"]["formation"]) => {
      setGameState((current) => ({
        ...current,
        tactic: {
          formation,
          positions: createFormationPositions(formation, current.squad.starters),
        },
      }));
    },
    [],
  );

  const setTacticalPositions = useCallback((positions: TacticalPosition[]) => {
    setGameState((current) => ({
      ...current,
      tactic: { ...current.tactic, positions },
    }));
  }, []);

  const setSquad = useCallback((starters: string[], bench: string[]) => {
    setGameState((current) => ({
      ...current,
      squad: { ...current.squad, starters, bench },
      tactic: {
        ...current.tactic,
        positions:
          current.tactic.positions.length === 0 && starters.length === 11
            ? createFormationPositions(current.tactic.formation, starters)
            : current.tactic.positions,
      },
    }));
  }, []);

  const getNextMatch = useCallback(() => {
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
        season: {
          ...current.season,
          currentRound: fixture.round,
        },
        match: {
          fixtureId: fixture.id,
          phase: "pre-match",
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeScore: 0,
          awayScore: 0,
          minute: 0,
          addedTime: 0,
          scheduledEndMinute: 90,
          events: [],
          stats: { ...INITIAL_MATCH_STATS },
        },
      };
    });
  }, []);

  const startMatch = useCallback(() => {
    setGameState((current) => {
      if (current.match.phase !== "pre-match") return current;

      const addedTime = randomAddedTime();

      return {
        ...current,
        match: {
          ...current.match,
          phase: "playing",
          addedTime,
          scheduledEndMinute: 90 + addedTime,
        },
      };
    });
  }, []);

  const simulateMatchTick = useCallback(() => {
    setGameState((current) => {
      if (
        current.match.phase !== "playing" ||
        !current.match.homeTeamId ||
        !current.match.awayTeamId
      ) {
        return current;
      }

      if (current.match.minute >= current.match.scheduledEndMinute) {
        return current;
      }

      const homeTeam = getTeamById(current.match.homeTeamId);
      const awayTeam = getTeamById(current.match.awayTeamId);

      if (!homeTeam || !awayTeam) return current;

      const homeSquad = buildInitialSquad(homeTeam.athletes);
      const awaySquad = buildInitialSquad(awayTeam.athletes);

      const homeStarters =
        homeTeam.id === current.player.teamId
          ? current.squad.starters
          : homeSquad.starters;

      const awayStarters =
        awayTeam.id === current.player.teamId
          ? current.squad.starters
          : awaySquad.starters;

      const result = runSimulationTick(
        {
          minute: current.match.minute,
          homeScore: current.match.homeScore,
          awayScore: current.match.awayScore,
          events: current.match.events,
          stats: current.match.stats,
        },
        homeTeam,
        awayTeam,
        homeStarters,
        awayStarters,
        current.match.scheduledEndMinute,
      );

      return {
        ...current,
        match: {
          ...current.match,
          minute: result.minute,
          homeScore: result.homeScore,
          awayScore: result.awayScore,
          events: result.events,
          stats: result.stats,
        },
      };
    });
  }, []);

  const setSeasonRound = useCallback((round: number) => {
    setGameState((current) => ({
      ...current,
      season: {
        ...current.season,
        currentRound: Math.max(1, Math.min(MAX_ROUND, round)),
      },
    }));
  }, []);

  const finishMatch = useCallback(() => {
    setGameState((current) => {
      const fixtureId = current.match.fixtureId;
      if (!fixtureId) return current;

      if (current.match.minute < current.match.scheduledEndMinute) {
        return current;
      }

      const currentFixture = current.season.fixtures.find(
        (fixture) => fixture.id === fixtureId,
      );

      if (!currentFixture || currentFixture.result) {
        return {
          ...current,
          match: { ...current.match, phase: "finished" },
        };
      }

      let fixtures = current.season.fixtures.map((fixture) =>
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

      fixtures = fixtures.map((fixture) => {
        if (
          fixture.round !== currentFixture.round ||
          fixture.result !== null
        ) {
          return fixture;
        }

        return simulateFixture(fixture);
      });

      const teamIds = getTeamIds();
      const standings = calculateStandings(
        teamIds,
        fixtures,
        getTeamNames(),
      );

      const nextRound = Math.min(MAX_ROUND, currentFixture.round + 1);

      return {
        ...current,
        season: {
          ...current.season,
          currentRound: nextRound,
          fixtures,
          standings,
        },
        match: {
          ...current.match,
          phase: "finished",
        },
      };
    });
  }, []);

  const startGame = useCallback(() => {
    setGameState((current) => ({ ...current, status: "playing" }));
  }, []);

  const resetGame = useCallback(() => {
    setGameState({
      ...INITIAL_GAME_STATE,
      match: {
        ...INITIAL_GAME_STATE.match,
        stats: { ...INITIAL_MATCH_STATS },
      },
    });
  }, []);

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

  if (!context) {
    throw new Error("useGame must be used inside GameProvider");
  }

  return context;
}

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

type GameContextData = {
  gameState: GameState;
  setTeam: (teamId: string) => void;
  setFormation: (formation: GameState["tactic"]["formation"]) => void;
  setTacticalPositions: (positions: TacticalPosition[]) => void;
  setSquad: (starters: string[], bench: string[]) => void;
  startGame: () => void;
  resetGame: () => void;
};

const GameContext = createContext<GameContextData | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(
    INITIAL_GAME_STATE,
  );

  function setTeam(teamId: string) {
    setGameState((current) => ({
      ...current,
      player: {
        ...current.player,
        teamId,
      },
      status: "playing",
    }));
  }

  function setFormation(
    formation: GameState["tactic"]["formation"],
  ) {
    setGameState((current) => ({
      ...current,
      tactic: {
        ...current.tactic,
        formation,
      },
    }));
  }

  function setTacticalPositions(positions: TacticalPosition[]) {
    setGameState((current) => ({
      ...current,
      tactic: {
        ...current.tactic,
        positions,
      },
    }));
  }

  function setSquad(starters: string[], bench: string[]) {
    setGameState((current) => ({
      ...current,
      squad: {
        starters,
        bench,
      },
    }));
  }

  function startGame() {
    setGameState((current) => ({
      ...current,
      status: "playing",
    }));
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

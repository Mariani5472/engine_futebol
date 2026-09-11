import { createContext, useContext, useState } from "react";
type GameContextData = {
  teamId: string | null;
  setTeamId: (teamId: string) => void;
};
const GameContext = createContext<GameContextData | null>(null);
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [teamId, setTeamId] = useState<string | null>(null);
  return (
    <GameContext.Provider value={{ teamId, setTeamId }}>
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
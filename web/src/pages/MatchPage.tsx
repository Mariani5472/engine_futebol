import { useGame } from "@/context/GameContext";

export function MatchPage() {
  const { gameState } = useGame();

  const {
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    minute,
  } = gameState.match;
  return (
    <>Pagina da Partida</>
  )
}
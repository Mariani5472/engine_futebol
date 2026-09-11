import { useGame } from "@/context/GameContext";

export function SquadPage() {
  const { gameState, setSquad } = useGame();

  console.log(gameState.player.teamId);
  return (
    <>Pagina do Elenco</>
  )
}
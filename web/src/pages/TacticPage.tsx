import { useGame } from "@/context/GameContext";

export function TacticPage() {
  const { gameState, setFormation } = useGame();

  console.log(gameState.tactic.formation);
  return (
    <>Pagina da tatica do time</>
  )
}
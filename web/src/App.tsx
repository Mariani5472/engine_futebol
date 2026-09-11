import { GameProvider } from "./context/GameContext";
import { AppRoutes } from "./routes/AppRoutes";
export function App() {
  return (
    <>
    <GameProvider>
      <AppRoutes />
    </GameProvider>
    </>
  )
}
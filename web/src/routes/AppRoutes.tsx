import { useGame } from "@/context/GameContext";
import { InGameLayout } from "@/layouts/InGameLayout";
import { MatchPage } from "@/pages/MatchPage";
import { SeasonPage } from "@/pages/SeasonPage";
import { SquadPage } from "@/pages/SquadPage";
import { TacticPage } from "@/pages/TacticPage";
import { TeamSelectionPage } from "@/pages/TeamSelectionPage";
import { lazy, Suspense, useEffect } from "react"
import { BrowserRouter, Outlet, Route, Routes, useNavigate } from "react-router-dom";

const StartPage = lazy(() => 
  import("@/pages/StartPage").then(module => ({default: module.StartPage}))
);

export function RouteLoadingFallback() {
    return (
        <main aria-busy="true" aria-live="polite">
            <p role="status">Carregando...</p>
        </main>
    );
}

function RequireTeam() {
  const { gameState } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!gameState.player.teamId) {
      navigate("/", { replace: true });
    }
  }, [gameState.player.teamId, navigate]);

  if (!gameState.player.teamId) {
    return null;
  }

  return <Outlet />;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/game" element={<TeamSelectionPage />} />

          <Route element={<RequireTeam />}>
            <Route element={<InGameLayout />}>
              <Route path="/game/season" element={<SeasonPage />} />
              <Route path="/game/squad" element={<SquadPage />} />
              <Route path="/game/tactic" element={<TacticPage />} />
              <Route path="/game/match" element={<MatchPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
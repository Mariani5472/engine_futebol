import { InGameLayout } from "@/layouts/InGameLayout";
import { MatchPage } from "@/pages/MatchPage";
import { SeasonPage } from "@/pages/SeasonPage";
import { SquadPage } from "@/pages/SquadPage";
import { TacticPage } from "@/pages/TacticPage";
import { TeamSelectionPage } from "@/pages/TeamSelectionPage";
import { lazy, Suspense } from "react"
import { BrowserRouter, Route, Routes } from "react-router-dom";

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

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense>
        <Routes>
          <Route path="/" element={<StartPage />} />
          <Route path="/game" element={<InGameLayout/>}>
            <Route index={true} element={<TeamSelectionPage />}/>
            <Route path="season" element={<SeasonPage  />}/>
            <Route path="squad" element={<SquadPage  />}/>
            <Route path="tactic" element={<TacticPage  />}/>
            <Route path="match" element={<MatchPage  />}/>
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
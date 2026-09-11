import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Menu,
  Shield,
  Swords,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useGame } from "@/context/GameContext";
import { getTeamById } from "@/domain/team/teams";

const navigation = [
  {
    label: "Temporada",
    path: "/game/season",
    icon: CalendarDays,
  },
  {
    label: "Elenco",
    path: "/game/squad",
    icon: Shield,
  },
  {
    label: "Tática",
    path: "/game/tactic",
    icon: Swords,
  },
];

export function InGameLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { gameState } = useGame();
  const teamId = gameState.player.teamId;

  const team = teamId ? getTeamById(teamId) : undefined;  
  if (!team) {
    return null;
  }

  useEffect(() => {
    if (!isSidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      
      setIsSidebarOpen(false);
      menuButtonRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isSidebarOpen]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const goTo = (path: string) => {
    navigate(path);
    setIsSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-muted/20 text-foreground">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/45 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col",
          "border-r bg-card",
          "transition-transform duration-200",
          "lg:static lg:translate-x-0",
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full",
        ].join(" ")}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
          <button
            type="button"
            onClick={() => goTo("/game/season")}
            className="flex items-center gap-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              ⚽
            </div>

            <div className="text-left">
              <strong className="block text-sm">
                TACTIC
              </strong>

              <span className="block text-xs text-muted-foreground">
                Manager 2026
              </span>
            </div>
          </button>

          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          <span className="mb-2 block px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Jogo
          </span>

          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                type="button"
                onClick={() => goTo(item.path)}
                className={[
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  "transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Club information */}
        <div className="border-t p-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Seu clube
            </span>

            <div className="flex items-center gap-3">
              <img
                src={team.logoUrl}
                alt={team.name}
                className="h-10 w-10 object-contain"
              />

              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {team.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  Brasileirão Série A
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() =>
                setIsSidebarOpen((current) => !current)
              }
              className="rounded-md p-2 hover:bg-muted lg:hidden"
              aria-label="Abrir menu"
              aria-expanded={isSidebarOpen}
              aria-controls="application-sidebar"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div>
              <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:block">
                Brasileirão Série A
              </span>

              <h1 className="text-sm font-semibold sm:text-base">
                Temporada 2026
              </h1>
            </div>
          </div>

          {/* Próximo jogo */}
          <Button
            type="button"
            onClick={() => navigate("/game/match")}
          >
            Próximo jogo
          </Button>
        </header>

        {/* Page */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8"
        >
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
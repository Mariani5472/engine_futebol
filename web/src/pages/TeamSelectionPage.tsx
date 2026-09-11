import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { teams } from "@/domain/team/teams";
import { useGame } from "@/context/GameContext";

export function TeamSelectionPage() {
  const navigate = useNavigate();
  const { setTeam } = useGame();

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const sortedTeams = [...teams].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  function handleConfirm() {
    if (!selectedTeamId) {
      return;
    }

    setTeam(selectedTeamId);
    navigate("/game/season");
  }

  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">
            Temporada 2026
          </p>

          <h1 className="mt-2 text-4xl font-bold">
            Escolha seu clube
          </h1>

          <p className="mt-2 text-muted-foreground">
            Escolha o time que você irá comandar durante a temporada.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sortedTeams.map((team) => {
            const isSelected = selectedTeamId === team.id;

            return (
              <button
                key={team.id}
                type="button"
                onClick={() => setSelectedTeamId(team.id)}
                className={[
                  "flex min-h-40 flex-col items-center justify-center gap-4 rounded-xl border p-6 transition",
                  "hover:border-primary hover:bg-accent",
                  isSelected
                    ? "border-primary bg-accent ring-2 ring-primary"
                    : "border-border bg-card",
                ].join(" ")}
              >
                <img
                  src={team.logoUrl}
                  alt={team.name}
                  className="h-20 w-20 object-contain"
                />

                <span className="text-center font-semibold">
                  {team.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-10 flex justify-end">
          <button
            type="button"
            disabled={!selectedTeamId}
            onClick={handleConfirm}
            className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            Confirmar clube
          </button>
        </div>
      </div>
    </main>
  );
}

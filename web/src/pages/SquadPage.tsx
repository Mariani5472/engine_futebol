import { useMemo, useState, type CSSProperties } from "react";
import { PlayerDetails } from "@/components/squad/PlayerDetails";
import { SquadTable, type SortKey } from "@/components/squad/SquadTable";
import { useGame } from "@/context/GameContext";
import { getTeamById } from "@/domain/team/teams";
import type { Athlete } from "@/domain/team/teams";
import { getPlayerOverall } from "@/domain/tactic/playerOverall";

const POSITION_FILTERS = [
  { value: "ALL", label: "Todos" },
  { value: "G", label: "Goleiros" },
  { value: "D", label: "Defensores" },
  { value: "M", label: "Meias" },
  { value: "F", label: "Atacantes" },
] as const;

type PositionFilter = (typeof POSITION_FILTERS)[number]["value"];

function getSquadAverageOverall(players: Athlete[]) {
  if (players.length === 0) return 0;

  const total = players.reduce(
    (sum, player) => sum + getPlayerOverall(player),
    0,
  );

  return Math.round(total / players.length);
}

export function SquadPage() {
  const { gameState } = useGame();
  const [sortBy, setSortBy] = useState<SortKey>("overall");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  const team = gameState.player.teamId ? getTeamById(gameState.player.teamId) : undefined;

  const playersById = useMemo(
    () => new Map((team?.athletes ?? []).map((player) => [player.id, player])),
    [team],
  );

  const filteredPlayers = useMemo(() => {
    if (positionFilter === "ALL") return team?.athletes ?? [];
    return (team?.athletes ?? []).filter((player) => player.position === positionFilter);
  }, [team, positionFilter]);

  const selectedPlayer = selectedPlayerId ? playersById.get(selectedPlayerId) : undefined;

  const averageOverall = useMemo(
    () => getSquadAverageOverall(filteredPlayers),
    [filteredPlayers],
  );

  const counts = useMemo(() => {
    const athletes = team?.athletes ?? [];
    return {
      total: athletes.length,
      goalkeepers: athletes.filter((player) => player.position === "G").length,
      defenders: athletes.filter((player) => player.position === "D").length,
      midfielders: athletes.filter((player) => player.position === "M").length,
      forwards: athletes.filter((player) => player.position === "F").length,
    };
  }, [team]);

  if (!team) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Nenhum clube selecionado.
      </div>
    );
  }

  return (
    <div
      className="space-y-5"
      style={
        {
          "--team-primary":
            team.colors.primary ?? "#ffffff",

          "--team-secondary":
            team.colors.secondary ?? "#000000",
        } as CSSProperties
      }
    >
        <div>
    <p
      className="text-xs font-semibold uppercase tracking-[0.2em]"
      style={{
        color: "var(--team-primary)",
      }}
    >
      Elenco
    </p>

    <div className="mt-1 flex items-center gap-3">
      <div
        className="rounded-xl p-2"
        style={{
          background:
            "color-mix(in srgb, var(--team-primary) 12%, transparent)",
        }}
      >
        <img
          src={team.logoUrl}
          alt=""
          className="h-10 w-10 object-contain"
        />
      </div>

      <h1 className="text-3xl font-bold">
        {team.name}
      </h1>
    </div>

    <p className="mt-1 text-sm text-muted-foreground">
      Consulte os jogadores do clube e suas informações principais.
    </p>
  </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Jogadores", counts.total],
          ["Goleiros", counts.goalkeepers],
          ["Defensores", counts.defenders],
          ["Meias", counts.midfielders],
          ["Atacantes", counts.forwards],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-4 shadow-sm" style={{
            borderColor: "color-mix(in srgb, var(--team-primary) 35%, transparent)",
          }}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {POSITION_FILTERS.map((filter) => {
          const active = positionFilter === filter.value;
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setPositionFilter(filter.value)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "text-white"
                  : "bg-card hover:bg-muted"
              }`}
              style={
                active
                  ? {
                      backgroundColor:
                        "var(--team-primary)",
                      borderColor:
                        "var(--team-primary)",
                    }
                  : undefined
              }
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <SquadTable
            players={filteredPlayers}
            sortBy={sortBy}
            onSort={setSortBy}
            selectedPlayerId={selectedPlayerId}
            onSelect={setSelectedPlayerId}
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Média do filtro
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {filteredPlayers.length} jogadores
              </span>
              <strong className="text-3xl">{averageOverall || "—"}</strong>
            </div>
          </div>

          <PlayerDetails player={selectedPlayer} />
        </div>
      </div>
    </div>
  );
}

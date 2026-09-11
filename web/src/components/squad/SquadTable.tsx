import type { Athlete } from "@/domain/team/teams";
import { getPlayerPositionLabel, getPositionOverall } from "@/domain/tactic/playerOverall";

type SortKey = "overall" | "name" | "position" | "age" | "marketValue";

type Props = {
  players: Athlete[];
  sortBy: SortKey;
  onSort: (sortBy: SortKey) => void;
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "overall", label: "Overall" },
  { value: "name", label: "Nome" },
  { value: "position", label: "Posição" },
  { value: "age", label: "Idade" },
  { value: "marketValue", label: "Valor de mercado" },
];

function formatMarketValue(value: number | null) {
  if (!value) return "—";
  if (value >= 1_000_000) return `€ ${(value / 1_000_000).toFixed(1)} mi`;
  return `€ ${Math.round(value / 1_000)} mil`;
}

function comparePlayers(a: Athlete, b: Athlete, sortBy: SortKey) {
  switch (sortBy) {
    case "name":
      return a.name.localeCompare(b.name, "pt-BR");
    case "position":
      return a.positionLabel.localeCompare(b.positionLabel, "pt-BR") || a.name.localeCompare(b.name, "pt-BR");
    case "age":
      return (a.age ?? 99) - (b.age ?? 99);
    case "marketValue":
      return (b.marketValue ?? 0) - (a.marketValue ?? 0);
    case "overall":
    default:
      return getPositionOverall(b, b.position) - getPositionOverall(a, a.position);
  }
}

export function SquadTable({ players, sortBy, onSort, selectedPlayerId, onSelect }: Props) {
  const sortedPlayers = [...players].sort((a, b) => comparePlayers(a, b, sortBy));

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Elenco completo
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {players.length} jogadores disponíveis no cadastro.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Ordenar por</span>
          <select
            value={sortBy}
            onChange={(event) => onSort(event.target.value as SortKey)}
            className="rounded-lg border bg-background px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/30"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-16 px-4 py-3 text-center">#</th>
              <th className="px-4 py-3 text-left">Jogador</th>
              <th className="px-4 py-3 text-left">Posição</th>
              <th className="px-4 py-3 text-center">Idade</th>
              <th className="px-4 py-3 text-center">Altura</th>
              <th className="px-4 py-3 text-center">OVR</th>
              <th className="px-4 py-3 text-right">Valor</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {sortedPlayers.map((player) => {
              const selected = selectedPlayerId === player.id;
              const overall = getPositionOverall(player, player.position);

              return (
                <tr
                  key={player.id}
                  onClick={() => onSelect(player.id)}
                  className={`cursor-pointer transition hover:bg-muted/50 ${selected ? "bg-accent/60" : ""}`}
                >
                  <td className="px-4 py-3 text-center font-semibold text-muted-foreground">
                    {player.jersey ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={player.photoUrl}
                        alt=""
                        className="h-9 w-9 rounded-full bg-muted object-cover"
                        loading="lazy"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{player.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {player.nationality ?? "Nacionalidade não informada"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{player.positionLabel}</span>
                    {player.positionsDetailed.length > 0 && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({player.positionsDetailed.join("/")})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{player.age ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    {player.heightCm ? `${player.heightCm} cm` : "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex min-w-9 justify-center rounded-md bg-muted px-2 py-1 font-bold">
                      {overall}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMarketValue(player.marketValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { SortKey };

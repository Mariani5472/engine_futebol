import type { Athlete } from "@/domain/team/teams";
import { getPlayerPositionLabel, getPositionOverall } from "@/domain/tactic/playerOverall";

type Props = {
  title: string;
  players: Athlete[];
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
  emptyText?: string;
};

export function SquadList({ title, players, selectedPlayerId, onSelect, emptyText = "Nenhum jogador" }: Props) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{players.length} jogadores</p>
        </div>
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
        {players.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>
        ) : players.map((player) => {
          const selected = selectedPlayerId === player.id;
          const overall = getPositionOverall(player, player.position);

          return (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelect(player.id)}
              className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition ${
                selected ? "border-primary bg-accent" : "border-transparent hover:border-border hover:bg-muted"
              }`}
            >
              <span className="w-7 text-center text-xs font-bold text-muted-foreground">{player.jersey ?? "—"}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{player.shortName || player.name}</p>
                <p className="truncate text-xs text-muted-foreground">{getPlayerPositionLabel(player)}</p>
              </div>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold">{overall}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

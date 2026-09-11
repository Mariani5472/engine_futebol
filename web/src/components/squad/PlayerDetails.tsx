import type { Athlete } from "@/domain/team/teams";
import { getPlayerPositionLabel, getPlayerOverall } from "@/domain/tactic/playerOverall";

type Props = {
  player: Athlete | undefined;
};

function formatMarketValue(value: number | null) {
  if (!value) return "Não informado";
  if (value >= 1_000_000) return `€ ${(value / 1_000_000).toFixed(1)} milhões`;
  return `€ ${Math.round(value / 1_000)} mil`;
}

function formatDate(date: string | null) {
  if (!date) return "Não informado";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Não informado";
  return parsed.toLocaleDateString("pt-BR");
}

export function PlayerDetails({ player }: Props) {
  if (!player) {
    return (
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Jogador selecionado
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Selecione um jogador na lista para ver os detalhes.
        </p>
      </section>
    );
  }

  const overall = getPlayerOverall(player);

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative h-24 bg-muted/60">
        <div className="absolute -bottom-8 left-5">
          <img
            src={player.photoUrl}
            alt=""
            className="h-20 w-20 rounded-full border-4 border-card bg-muted object-cover shadow-md"
          />
        </div>
      </div>

      <div className="p-5 pt-12">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold">{player.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {getPlayerPositionLabel(player)}
            </p>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-center">
            <span className="block text-[10px] font-semibold uppercase text-muted-foreground">OVR</span>
            <strong className="text-xl">{overall}</strong>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Camisa</dt>
            <dd className="mt-1 font-semibold">{player.jersey ?? "—"}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Idade</dt>
            <dd className="mt-1 font-semibold">{player.age != null ? `${player.age} anos` : "—"}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Altura</dt>
            <dd className="mt-1 font-semibold">{player.heightCm ? `${player.heightCm} cm` : "—"}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Peso</dt>
            <dd className="mt-1 font-semibold">{player.weightKg ? `${player.weightKg} kg` : "—"}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Pé dominante</dt>
            <dd className="mt-1 font-semibold">{player.preferredFoot ?? "—"}</dd>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <dt className="text-xs text-muted-foreground">Nacionalidade</dt>
            <dd className="mt-1 truncate font-semibold">{player.nationality ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
          <span className="block text-xs text-muted-foreground">Nascimento</span>
          <strong>{formatDate(player.dateOfBirth)}</strong>
        </div>

        <div className="mt-2 rounded-lg bg-muted/50 p-3 text-sm">
          <span className="block text-xs text-muted-foreground">Valor de mercado</span>
          <strong>{formatMarketValue(player.marketValue)}</strong>
        </div>

        <div className="mt-4 rounded-lg border border-dashed p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
          <p className="mt-1 text-sm font-medium">Disponível</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Lesões, suspensões, fadiga e moral entram no estado do jogo nas próximas versões.
          </p>
        </div>
      </div>
    </section>
  );
}

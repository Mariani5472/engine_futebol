import { useEffect, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

import { useGame } from "@/context/GameContext";
import { getTeamById } from "@/domain/team/teams";

function formatCapacity(capacity: number | null) {
  if (!capacity) return null;
  return `${capacity.toLocaleString("pt-BR")} lugares`;
}

function formatMinute(minute: number) {
  if (minute <= 90) return `${minute}'`;
  return `90+${minute - 90}'`;
}

function TeamMatchMeta({
  teamName,
  manager,
  venue,
  align = "left",
}: {
  teamName: string;
  manager: string | null;
  venue: string | null;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {teamName}
      </p>
      <p className="mt-1 text-sm">
        Técnico: <strong>{manager ?? "Não informado"}</strong>
      </p>
      {venue && (
        <p className="mt-1 text-xs text-muted-foreground">{venue}</p>
      )}
    </div>
  );
}

export function MatchPage() {
  const {
    gameState,
    getNextMatch,
    startMatch,
    simulateMatchTick,
    finishMatch,
  } = useGame();

  const navigate = useNavigate();

  const {
    phase,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    minute,
    addedTime,
    scheduledEndMinute,
    events,
    stats,
  } = gameState.match;

  const homeTeam = homeTeamId ? getTeamById(homeTeamId) : undefined;
  const awayTeam = awayTeamId ? getTeamById(awayTeamId) : undefined;

  useEffect(() => {
    if (phase === "idle") {
      getNextMatch();
    }
  }, [phase, getNextMatch]);

  useEffect(() => {
    if (phase !== "playing") return;

    if (minute >= scheduledEndMinute) {
      finishMatch();
      return;
    }

    const timer = window.setTimeout(() => {
      simulateMatchTick();
    }, 170);

    return () => window.clearTimeout(timer);
  }, [phase, minute, scheduledEndMinute, simulateMatchTick, finishMatch]);

  if (!homeTeam || !awayTeam) {
    return (
      <div
        className="rounded-xl border bg-card p-8 text-center"
        style={
          {
            "--home-primary": homeTeam?.colors.primary ?? "#ffffff",
            "--home-secondary": homeTeam?.colors.secondary ?? "#000000",
            "--away-primary": awayTeam?.colors.primary ?? "#ffffff",
            "--away-secondary": awayTeam?.colors.secondary ?? "#000000",
          } as CSSProperties
        }
      >
        <p className="text-muted-foreground">Nenhuma partida encontrada.</p>

        <button
          type="button"
          onClick={() => navigate("/game/season")}
          className="mt-4 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted"
        >
          Voltar para temporada
        </button>
      </div>
    );
  }

  if (phase === "pre-match") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Pré-jogo
          </p>

          <h1 className="mt-2 text-3xl font-bold">Campeonato Brasileiro</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Rodada {gameState.season.currentRound}
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <div className="text-center">
              <img
                src={homeTeam.logoUrl}
                alt=""
                className="mx-auto h-24 w-24 object-contain"
              />
              <h2 className="mt-4 text-xl font-bold">{homeTeam.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mandante</p>
            </div>

            <div className="text-center">
              <span className="text-2xl font-bold">VS</span>
            </div>

            <div className="text-center">
              <img
                src={awayTeam.logoUrl}
                alt=""
                className="mx-auto h-24 w-24 object-contain"
              />
              <h2 className="mt-4 text-xl font-bold">{awayTeam.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Visitante</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 border-t pt-6 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 p-4">
              <TeamMatchMeta
                teamName={homeTeam.name}
                manager={homeTeam.manager?.name ?? null}
                venue={homeTeam.venue?.name ?? null}
              />
            </div>

            <div className="rounded-xl bg-muted/40 p-4">
              <TeamMatchMeta
                teamName={awayTeam.name}
                manager={awayTeam.manager?.name ?? null}
                venue={awayTeam.venue?.name ?? null}
                align="right"
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estádio da partida
            </p>
            <p className="mt-1 font-bold">
              {homeTeam.venue?.name ?? "Estádio não informado"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[homeTeam.venue?.city, formatCapacity(homeTeam.venue?.capacity ?? null)]
                .filter(Boolean)
                .join(" • ") || "Informações do estádio não disponíveis"}
            </p>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={startMatch}
              className="rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground transition hover:opacity-90"
            >
              Iniciar partida
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "playing") {
    const recentEvents = events.slice(-8).reverse();

    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Ao vivo
            </p>

            <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
              <div className="text-right">
                <div className="flex items-center justify-end gap-3">
                  <span className="font-bold">{homeTeam.name}</span>
                  <img src={homeTeam.logoUrl} alt="" className="h-12 w-12 object-contain" />
                </div>
              </div>

              <div className="text-center">
                <div className="text-4xl font-black">
                  {homeScore} - {awayScore}
                </div>
                <div className="mt-1 text-sm font-bold text-muted-foreground">
                  {formatMinute(minute)}
                </div>
                {addedTime > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Acréscimos: +{addedTime} min
                  </div>
                )}
              </div>

              <div className="text-left">
                <div className="flex items-center gap-3">
                  <img src={awayTeam.logoUrl} alt="" className="h-12 w-12 object-contain" />
                  <span className="font-bold">{awayTeam.name}</span>
                </div>
              </div>
            </div>

            {homeTeam.venue && (
              <p className="mt-3 text-xs text-muted-foreground">
                {homeTeam.venue.name}
                {homeTeam.venue.city ? ` • ${homeTeam.venue.city}` : ""}
              </p>
            )}
          </div>
        </div>

        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-bold">Acontecimentos</h2>
          </div>

          <div className="divide-y">
            {recentEvents.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                A partida começou...
              </p>
            ) : (
              recentEvents.map((event, index) => {
                const isHome = event.teamId === gameState.match.homeTeamId;

                return (
                  <div
                    key={`${event.minute}-${event.playerId}-${index}`}
                    className={
                      isHome
                        ? "match-event match-event-home"
                        : "match-event match-event-away"
                    }
                  >
                    <span className="match-event-minute">{formatMinute(event.minute)}</span>
                    <span className="match-event-text">{event.text}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            ["Finalizações", `${stats.homeShots} - ${stats.awayShots}`],
            ["No alvo", `${stats.homeShotsOnTarget} - ${stats.awayShotsOnTarget}`],
            ["Escanteios", `${stats.homeCorners} - ${stats.awayCorners}`],
            ["Faltas", `${stats.homeFouls} - ${stats.awayFouls}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-4 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 font-bold">{value}</p>
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Fim de jogo
          </p>
          <h1 className="mt-2 text-3xl font-bold">Resultado final</h1>
        </div>

        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <div className="text-center">
              <img src={homeTeam.logoUrl} alt="" className="mx-auto h-20 w-20 object-contain" />
              <p className="mt-3 font-bold">{homeTeam.name}</p>
            </div>

            <div className="text-5xl font-black">
              {homeScore} - {awayScore}
            </div>

            <div className="text-center">
              <img src={awayTeam.logoUrl} alt="" className="mx-auto h-20 w-20 object-contain" />
              <p className="mt-3 font-bold">{awayTeam.name}</p>
            </div>
          </div>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            90 minutos + {addedTime} de acréscimos
          </div>

          <div className="mt-6 grid gap-3 border-t pt-6 sm:grid-cols-2">
            <TeamMatchMeta
              teamName={homeTeam.name}
              manager={homeTeam.manager?.name ?? null}
              venue={homeTeam.venue?.name ?? null}
            />
            <TeamMatchMeta
              teamName={awayTeam.name}
              manager={awayTeam.manager?.name ?? null}
              venue={awayTeam.venue?.name ?? null}
              align="right"
            />
          </div>

          <div className="mt-8 border-t pt-6">
            <h2 className="font-bold">Acontecimentos</h2>

            <div className="mt-3 space-y-2">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum acontecimento registrado.
                </p>
              ) : (
                events
                  .slice()
                  .reverse()
                  .map((event, index) => {
                    const isHome = event.teamId === gameState.match.homeTeamId;

                    return (
                      <div
                        key={`${event.minute}-${event.playerId}-${index}`}
                        className={
                          isHome
                            ? "match-event match-event-home"
                            : "match-event match-event-away"
                        }
                      >
                        <span className="match-event-minute">{formatMinute(event.minute)}</span>
                        <span className="match-event-text">{event.text}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={() => navigate("/game/season")}
              className="rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground transition hover:opacity-90"
            >
              Voltar para temporada
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

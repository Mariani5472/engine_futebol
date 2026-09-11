import { useMemo } from "react";

import { useGame } from "@/context/GameContext";
import { getTeamById } from "@/domain/team/teams";
import { getFixturesByRound } from "@/domain/season/fixtures";

function FormIndicator({
  form,
}: {
  form: Array<"W" | "D" | "L">;
}) {
  if (form.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        —
      </span>
    );
  }

  return (
    <div className="flex gap-1">
      {form.map((result, index) => (
        <span
          key={`${result}-${index}`}
          className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
            result === "W"
              ? "bg-green-500/15 text-green-600"
              : result === "D"
                ? "bg-yellow-500/15 text-yellow-600"
                : "bg-red-500/15 text-red-600"
          }`}
        >
          {result}
        </span>
      ))}
    </div>
  );
}

function getTeamName(teamId: string) {
  return getTeamById(teamId)?.name ?? "Desconhecido";
}

function getTeamLogo(teamId: string) {
  return getTeamById(teamId)?.logoUrl;
}

export function SeasonPage() {
  const {
    gameState,
    setSeasonRound,
  } = useGame();

  const currentRound = gameState.season.currentRound;

  const fixtures = useMemo(
    () =>
      getFixturesByRound(
        gameState.season.fixtures,
        currentRound,
      ),
    [gameState.season.fixtures, currentRound],
  );

  const canGoPrevious = currentRound > 1;
  const canGoNext = currentRound < 38;

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Temporada
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Campeonato Brasileiro {gameState.season.year}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe classificação, partidas e desempenho dos jogadores.
          </p>
        </div>        
      </div>

      {/* CLASSIFICAÇÃO */}

      <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-bold">
            Classificação
          </h2>

          <p className="text-sm text-muted-foreground">
            Campeonato Brasileiro {gameState.season.year}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                <th className="w-12 px-3 py-3 text-center">#</th>

                <th className="px-3 py-3 text-left">
                  Clube
                </th>

                <th className="px-3 py-3 text-center">J</th>
                <th className="px-3 py-3 text-center">V</th>
                <th className="px-3 py-3 text-center">E</th>
                <th className="px-3 py-3 text-center">D</th>
                <th className="px-3 py-3 text-center">GP</th>
                <th className="px-3 py-3 text-center">GC</th>
                <th className="px-3 py-3 text-center">SG</th>
                <th className="px-3 py-3 text-center">PTS</th>

                <th className="px-3 py-3 text-left">
                  Forma
                </th>
              </tr>
            </thead>

            <tbody>
              {gameState.season.standings.map(
                (standing, index) => {
                  const team = getTeamById(
                    standing.teamId,
                  );

                  const isPlayerTeam =
                    standing.teamId ===
                    gameState.player.teamId;

                  return (
                    <tr
                      key={standing.teamId}
                      className={`border-b last:border-0 ${
                        isPlayerTeam
                          ? "bg-primary/5"
                          : "hover:bg-muted/20"
                      }`}
                    >
                      <td className="px-3 py-3 text-center font-bold">
                        {index + 1}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={team?.logoUrl}
                            alt=""
                            className="h-7 w-7 object-contain"
                          />

                          <span
                            className={
                              isPlayerTeam
                                ? "font-bold"
                                : "font-medium"
                            }
                          >
                            {team?.name ??
                              "Desconhecido"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.played}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.wins}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.draws}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.losses}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.goalsFor}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.goalsAgainst}
                      </td>

                      <td className="px-3 py-3 text-center">
                        {standing.goalDifference > 0
                          ? `+${standing.goalDifference}`
                          : standing.goalDifference}
                      </td>

                      <td className="px-3 py-3 text-center font-bold">
                        {standing.points}
                      </td>

                      <td className="px-3 py-3">
                        <FormIndicator
                          form={standing.form}
                        />
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-2 shadow-sm">
        <button
          type="button"
          disabled={!canGoPrevious}
          onClick={() => setSeasonRound(currentRound - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          ←
        </button>

        <div className="min-w-28 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rodada
          </p>

          <p className="font-bold">
            {currentRound} / 38
          </p>
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => setSeasonRound(currentRound + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
        >
          →
        </button>
      </div>

      {/* JOGOS DA RODADA */}

      <section className="rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-bold">
            Jogos da rodada
          </h2>

          <p className="text-sm text-muted-foreground">
            Rodada {currentRound}
          </p>
        </div>

        <div className="grid gap-2 p-4 md:grid-cols-2">
          {fixtures.map((fixture) => {
            const homeLogo = getTeamLogo(
              fixture.homeTeamId,
            );

            const awayLogo = getTeamLogo(
              fixture.awayTeamId,
            );

            return (
              <div
                key={fixture.id}
                className="rounded-lg border p-4"
              >
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="flex items-center justify-end gap-2 text-right">
                    <span className="text-sm font-semibold">
                      {getTeamName(
                        fixture.homeTeamId,
                      )}
                    </span>

                    <img
                      src={homeLogo}
                      alt=""
                      className="h-8 w-8 object-contain"
                    />
                  </div>

                  <div className="min-w-16 text-center">
                    {fixture.result ? (
                      <span className="text-lg font-bold">
                        {fixture.result.homeScore}
                        {" - "}
                        {fixture.result.awayScore}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">
                        vs
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <img
                      src={awayLogo}
                      alt=""
                      className="h-8 w-8 object-contain"
                    />

                    <span className="text-sm font-semibold">
                      {getTeamName(
                        fixture.awayTeamId,
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ARTILHARIA / ASSISTÊNCIAS */}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-bold">
              Artilharia
            </h2>

            <p className="text-sm text-muted-foreground">
              Melhores marcadores da temporada
            </p>
          </div>

          <div className="p-4">
            {gameState.season.playerStats.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum gol registrado ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {gameState.season.playerStats
                  .filter((player) => player.goals > 0)
                  .sort((a, b) => b.goals - a.goals)
                  .slice(0, 10)
                  .map((player, index) => (
                    <div
                      key={player.playerId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="text-sm">
                        {index + 1}.{" "}
                        {player.playerId}
                      </span>

                      <strong>
                        {player.goals}
                      </strong>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b p-4">
            <h2 className="font-bold">
              Assistências
            </h2>

            <p className="text-sm text-muted-foreground">
              Melhores garçons da temporada
            </p>
          </div>

          <div className="p-4">
            {gameState.season.playerStats.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma assistência registrada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {gameState.season.playerStats
                  .filter(
                    (player) => player.assists > 0,
                  )
                  .sort(
                    (a, b) =>
                      b.assists - a.assists,
                  )
                  .slice(0, 10)
                  .map((player, index) => (
                    <div
                      key={player.playerId}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <span className="text-sm">
                        {index + 1}.{" "}
                        {player.playerId}
                      </span>

                      <strong>
                        {player.assists}
                      </strong>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
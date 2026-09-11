import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormationSelector } from "@/components/tactic/FormationSelector";
import { SquadList } from "@/components/tactic/SquadList";
import { TacticalPitch } from "@/components/tactic/TacticalPitch";
import { useGame } from "@/context/GameContext";
import type { Formation } from "@/context/GameState";
import { getTeamById } from "@/domain/team/teams";
import type { Athlete } from "@/domain/team/teams";
import { getPlayerPositionLabel, getPositionOverall } from "@/domain/tactic/playerOverall";
import { buildInitialSquad } from "@/domain/tactic/squad";

function isGoalkeeper(player: Athlete) {
  return (
    player.position === "G" ||
    player.position === "GK" ||
    player.positionsDetailed.includes("GK")
  );
}

function getRoleFromPosition(y: number) {
  if (y > 84) return "GK" as const;
  if (y > 65) return "D" as const;
  if (y > 42) return "M" as const;
  return "F" as const;
}

export function TacticPage() {
  const { gameState, setFormation, setSquad, setTacticalPositions } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const team = gameState.player.teamId ? getTeamById(gameState.player.teamId) : undefined;
  const playersById = useMemo(
    () => new Map((team?.athletes ?? []).map((player) => [player.id, player])),
    [team],
  );

  const starters = gameState.squad.starters
    .map((id) => playersById.get(id))
    .filter((player): player is Athlete => Boolean(player));

  const bench = gameState.squad.bench
    .map((id) => playersById.get(id))
    .filter((player): player is Athlete => Boolean(player));

  const selectedPlayer = selectedPlayerId
    ? playersById.get(selectedPlayerId)
    : undefined;

  useEffect(() => {
    if (!team || gameState.squad.starters.length > 0) return;

    const initial = buildInitialSquad(team.athletes);
    setSquad(initial.starters, initial.bench);
    setSelectedPlayerId(initial.starters[0] ?? null);
  }, [team, gameState.squad.starters.length, setSquad]);

  function movePlayer(playerId: string, x: number, y: number) {
    setTacticalPositions(
      gameState.tactic.positions.map((position) =>
        position.playerId === playerId ? { ...position, x, y } : position,
      ),
    );
    setSaved(false);
  }

  function changeFormation(formation: Formation) {
    setFormation(formation);
    setSaved(false);
  }

  function swapPlayers(starterId: string, benchId: string) {
    const starter = playersById.get(starterId);
    const substitute = playersById.get(benchId);
    if (!starter || !substitute) return;

    const currentGoalkeepers = gameState.squad.starters.filter((id) => {
      const player = playersById.get(id);
      return player ? isGoalkeeper(player) : false;
    }).length;

    const nextGoalkeepers =
      currentGoalkeepers -
      (isGoalkeeper(starter) ? 1 : 0) +
      (isGoalkeeper(substitute) ? 1 : 0);

    if (nextGoalkeepers !== 1) return;

    setSquad(
      gameState.squad.starters.map((id) =>
        id === starterId ? benchId : id,
      ),
      gameState.squad.bench.map((id) =>
        id === benchId ? starterId : id,
      ),
    );

    setTacticalPositions(
      gameState.tactic.positions.map((position) =>
        position.playerId === starterId
          ? { ...position, playerId: benchId }
          : position,
      ),
    );

    setSelectedPlayerId(benchId);
    setSaved(false);
  }

  function selectPlayer(playerId: string) {
    if (
      gameState.squad.bench.includes(playerId) &&
      selectedPlayerId &&
      gameState.squad.starters.includes(selectedPlayerId)
    ) {
      swapPlayers(selectedPlayerId, playerId);
      return;
    }

    setSelectedPlayerId(playerId);
  }

  if (!team) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        Nenhum clube selecionado.
      </div>
    );
  }

  const selectedPosition = gameState.tactic.positions.find(
    (position) => position.playerId === selectedPlayerId,
  );
  const selectedRole = selectedPosition
    ? getRoleFromPosition(selectedPosition.y)
    : "F";
  const selectedOverall = selectedPlayer
    ? getPositionOverall(selectedPlayer, selectedRole)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Tática
          </p>
          <h1 className="mt-1 text-3xl font-bold">{team.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Defina a formação e arraste os jogadores livremente pelo campo.
          </p>
        </div>

        <Button type="button" onClick={() => setSaved(true)}>
          {saved ? "Tática salva" : "Salvar tática"}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(420px,1fr)_280px]">
        <div className="space-y-5">
          <FormationSelector
            value={gameState.tactic.formation}
            onChange={changeFormation}
          />

          <SquadList
            title="Banco"
            players={bench}
            selectedPlayerId={selectedPlayerId}
            onSelect={selectPlayer}
          />
        </div>

        <TacticalPitch
          positions={gameState.tactic.positions}
          playersById={playersById}
          selectedPlayerId={selectedPlayerId}
          onSelect={selectPlayer}
          onMove={movePlayer}
        />

        <div className="space-y-5">
          <SquadList
            title="Titulares"
            players={starters}
            selectedPlayerId={selectedPlayerId}
            onSelect={selectPlayer}
          />

          <section className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Jogador selecionado
            </p>

            {selectedPlayer ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedPlayer.photoUrl}
                    alt=""
                    className="h-14 w-14 rounded-full object-cover"
                  />

                  <div className="min-w-0">
                    <h2 className="truncate font-bold">{selectedPlayer.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {getPlayerPositionLabel(selectedPlayer)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/60 p-3">
                    <span className="block text-xs text-muted-foreground">Posição</span>
                    <strong>{selectedRole}</strong>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <span className="block text-xs text-muted-foreground">OVR</span>
                    <strong>{selectedOverall}</strong>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <span className="block text-xs text-muted-foreground">Idade</span>
                    <strong>{selectedPlayer.age ?? "—"}</strong>
                  </div>
                  <div className="rounded-lg bg-muted/60 p-3">
                    <span className="block text-xs text-muted-foreground">Camisa</span>
                    <strong>{selectedPlayer.jersey ?? "—"}</strong>
                  </div>
                </div>

                {gameState.squad.bench.includes(selectedPlayer.id) && (
                  <p className="text-xs text-muted-foreground">
                    Clique em um titular para colocá-lo no lugar deste jogador.
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Selecione um jogador no campo ou na lista.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

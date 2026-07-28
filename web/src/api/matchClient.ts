import type { MatchSnapshot } from "../simulation/types";

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3000`;
let matchPromise: Promise<{ id: string }> | null = null;

export function getOrCreateMatch(): Promise<{ id: string }> {
  matchPromise ??= fetch(`${API_URL}/matches`, { method: "POST" }).then(async (response) => {
    if (!response.ok) throw new Error(`Could not create match: ${response.status}`);
    return response.json() as Promise<{ id: string }>;
  });
  return matchPromise;
}

export function subscribeToMatch(
  id: string,
  handlers: {
    onSnapshot: (snapshot: MatchSnapshot) => void;
    onSpeedChanged: (speed: 1 | 2 | 4 | 8) => void;
  },
): WebSocket {
  const url = new URL(API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/matches/${id}/stream`;
  const socket = new WebSocket(url);
  socket.addEventListener("message", (event) => {
    const wire = JSON.parse(event.data) as any;
    if (wire.type === "speed_changed") {
      handlers.onSpeedChanged(wire.speed);
      return;
    }
    handlers.onSnapshot({
      type: "snapshot",
      matchId: wire.matchId,
      sequence: wire.sequence,
      time: wire.matchSecond,
      status: wire.status === "FINISHED" ? "PAUSED" : wire.status,
      homePhase: wire.homePhase,
      awayPhase: wire.awayPhase,
      phase: wire.phase,
      players: wire.players.map((player: any) => ({
        id: player.id,
        number: Number(player.id.match(/(\d+)$/)?.[1] ?? 0),
        team: player.teamId === "home" ? "HOME" : "AWAY",
        x: player.position.x / wire.pitch.length * 100,
        y: player.position.y / wire.pitch.width * 100,
        hasBall: player.hasBall,
        targetPosition: {
          x: player.targetPosition.x / wire.pitch.length * 100,
          y: player.targetPosition.y / wire.pitch.width * 100,
        },
        tacticalAnchorPosition: {
          x: player.tacticalAnchorPosition.x / wire.pitch.length * 100,
          y: player.tacticalAnchorPosition.y / wire.pitch.width * 100,
        },
        role: player.role,
      })),
      ball: {
        x: wire.ball.position.x / wire.pitch.length * 100,
        y: wire.ball.position.y / wire.pitch.width * 100,
        height: wire.ball.height,
        motionKind: wire.ball.motion?.kind ?? null,
        hasExplicitEffect: wire.ball.motion?.hasExplicitEffect ?? false,
      },
      tacticalDiagnostics: wire.tacticalDiagnostics,
      tacticalDebug: {
        carrierId: wire.tacticalDebug.carrierId,
        passOptionIds: wire.tacticalDebug.passOptionIds,
        homeSectors: mapSectors(wire.tacticalDebug.homeSectors, wire.pitch),
        awaySectors: mapSectors(wire.tacticalDebug.awaySectors, wire.pitch),
      },
    });
  });
  return socket;
}

function mapSectors(sectors: any, pitch: { length:number; width:number }) {
  const point = (value:any) => value ? ({ x:value.x / pitch.length * 100, y:value.y / pitch.width * 100 }) : null;
  return { defence:point(sectors.defence), midfield:point(sectors.midfield), attack:point(sectors.attack) };
}

export async function controlMatch(id: string, action: "pause" | "resume"): Promise<void> {
  const response = await fetch(`${API_URL}/matches/${id}/${action}`, { method: "POST" });
  if (!response.ok) throw new Error(`Could not ${action} match: ${response.status}`);
}

export async function setMatchSpeed(id: string, speed: 1 | 2 | 4 | 8): Promise<void> {
  const response = await fetch(`${API_URL}/matches/${id}/speed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ speed }),
  });
  if (!response.ok) throw new Error(`Could not set match speed: ${response.status}`);
}

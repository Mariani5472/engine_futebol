import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { randomUUID } from "node:crypto";
import { LiveMatchSession } from "./LiveMatchSession.js";
import { DecisionType } from "../../engine/src/application/match/decision/DecisionType.js";
import { PLAYER_ACTION_SPACE } from "../../engine/src/application/match/policy/PlayerActionSpace.js";
import type { PlayerActionCommand } from "../../engine/src/application/match/policy/PlayerPolicy.js";

const app = Fastify({ logger: true });
const matches = new Map<string, LiveMatchSession>();

await app.register(cors, { origin: true });
await app.register(websocket);

app.get("/health", async () => ({ status: "ok", matches: matches.size }));

app.get("/action-space", async () => ({
  version: PLAYER_ACTION_SPACE.version,
  actions: PLAYER_ACTION_SPACE.actions,
}));

app.post<{ Body?: { seed?: number } }>("/matches", async (request, reply) => {
  const requestedSeed = request.body?.seed ?? 1;
  if (!Number.isInteger(requestedSeed) || requestedSeed < 1) return reply.code(400).send({ message: "Seed must be a positive integer" });
  const match = new LiveMatchSession(randomUUID(), requestedSeed);
  matches.set(match.id, match);
  return reply.code(201).send({ id: match.id, seed: requestedSeed, status: "RUNNING", websocketPath: `/matches/${match.id}/stream` });
});

app.get<{ Params: { id: string } }>("/matches/:id", async (request, reply) => {
  const match = matches.get(request.params.id);
  return match ? match.current() : reply.code(404).send({ message: "Match not found" });
});

app.get<{ Params: { id: string } }>("/matches/:id/report", async (request, reply) => {
  const match=matches.get(request.params.id);
  if(!match)return reply.code(404).send({message:"Match not found"});
  const archive=match.archive();
  return archive??reply.code(409).send({message:"Match is still running"});
});

app.get<{ Params: { id: string } }>("/matches/:id/policy-decisions", async (request, reply) => {
  const match = matches.get(request.params.id);
  return match ? match.policyTranscript() : reply.code(404).send({ message: "Match not found" });
});

app.get<{ Params: { id: string; playerId: string } }>("/matches/:id/players/:playerId/action-mask", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  try {
    const mask = match.actionMask(request.params.playerId);
    return mask ?? reply.code(409).send({ message: "Action mask is not available before the player's next decision window" });
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.post<{ Params: { id: string; playerId: string } }>("/matches/:id/players/:playerId/control", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  try {
    match.controlPlayer(request.params.playerId);
    return reply.code(200).send({ playerId: request.params.playerId, controlled: true });
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.delete<{ Params: { id: string; playerId: string } }>("/matches/:id/players/:playerId/control", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  match.releasePlayer(request.params.playerId);
  return reply.code(200).send({ playerId: request.params.playerId, controlled: false });
});

app.post<{
  Params: { id: string; playerId: string };
  Body?: { actionId?: string; type?: string | number; targetId?: string };
}>("/matches/:id/players/:playerId/actions", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  try {
    const command = parsePlayerActionCommand(request.body);
    if (!command) return reply.code(400).send({ message: "Provide one valid non-NONE actionId or DecisionType" });
    match.submitPlayerAction(request.params.playerId, command);
    const type = command.actionId !== undefined
      ? PLAYER_ACTION_SPACE.actionForId(command.actionId).decisionType
      : command.type;
    return reply.code(202).send({
      playerId: request.params.playerId,
      queued: true,
      actionId: PLAYER_ACTION_SPACE.actionForType(type).id,
      type: DecisionType[type],
      targetId: request.body?.targetId ?? null,
    });
  } catch (error) {
    return reply.code(400).send({ message: (error as Error).message });
  }
});

app.get<{ Params: { id: string; goalEventId: string } }>("/matches/:id/replays/:goalEventId", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  const replay = match.goalReplay(request.params.goalEventId);
  return replay ? replay : reply.code(404).send({ message: "Replay not available" });
});

app.post<{ Params: { id: string; action: string }; Body?: { speed?: number } }>("/matches/:id/:action", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  if (request.params.action === "pause") return match.pause();
  if (request.params.action === "resume") return match.resume();
  if (request.params.action === "speed" && request.body?.speed) {
    try { return match.setSpeed(request.body.speed); }
    catch (error) { return reply.code(400).send({ message: (error as Error).message }); }
  }
  if (request.params.action === "step") {
    try { return match.step(Number((request.body as { count?:number } | undefined)?.count ?? 1)); }
    catch (error) { return reply.code(400).send({ message: (error as Error).message }); }
  }
  return reply.code(400).send({ message: "Unsupported action" });
});

app.get<{ Params: { id: string } }>("/matches/:id/stream", { websocket: true }, (socket, request) => {
  const match = matches.get(request.params.id);
  if (!match) return socket.close(1008, "Match not found");
  match.addClient(socket);
});

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 3000) });

function parseDecisionType(value: string | number | undefined): DecisionType | null {
  if (typeof value === "number" && Number.isInteger(value) && DecisionType[value] !== undefined) {
    return value as DecisionType;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    const parsed = DecisionType[normalized as keyof typeof DecisionType];
    if (typeof parsed === "number") return parsed;
  }
  return null;
}

function parsePlayerActionCommand(
  body: { actionId?: string; type?: string | number; targetId?: string } | undefined,
): PlayerActionCommand | null {
  if (!body || (body.actionId !== undefined && body.type !== undefined)) return null;
  if (body.actionId !== undefined) {
    const action = PLAYER_ACTION_SPACE.actionForId(body.actionId.trim().toUpperCase());
    if (action.decisionType === DecisionType.NONE) return null;
    return { actionId: action.id, targetId: body.targetId };
  }
  const type = parseDecisionType(body.type);
  return type === null || type === DecisionType.NONE ? null : { type, targetId: body.targetId };
}

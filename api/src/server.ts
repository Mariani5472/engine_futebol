import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { randomUUID } from "node:crypto";
import { LiveMatchSession } from "./LiveMatchSession.js";

const app = Fastify({ logger: true });
const matches = new Map<string, LiveMatchSession>();

await app.register(cors, { origin: true });
await app.register(websocket);

app.get("/health", async () => ({ status: "ok", matches: matches.size }));

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

app.post<{ Params: { id: string; action: string }; Body?: { speed?: number } }>("/matches/:id/:action", async (request, reply) => {
  const match = matches.get(request.params.id);
  if (!match) return reply.code(404).send({ message: "Match not found" });
  if (request.params.action === "pause") return match.pause();
  if (request.params.action === "resume") return match.resume();
  if (request.params.action === "speed" && request.body?.speed) {
    try { return match.setSpeed(request.body.speed); }
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

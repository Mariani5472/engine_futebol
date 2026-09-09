import type { EspnRosterResponse } from "./models.js";

const BASE_URL = "https://site.web.api.espn.com/apis/site/v2/sports/soccer/BRA.1/teams";

export function rosterUrl(teamId: string): string {
  const query = new URLSearchParams({
    region: "br",
    lang: "pt",
    contentorigin: "deportes",
    limit: "99",
    sort: "jersey:asc",
    season: "2026"
  });
  return `${BASE_URL}/${teamId}/roster?${query}`;
}

export async function fetchRoster(teamId: string, attempts = 2): Promise<EspnRosterResponse> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch(rosterUrl(teamId), { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as EspnRosterResponse;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha desconhecida ao consultar ESPN");
}

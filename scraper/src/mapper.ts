import type { Athlete, EspnRosterResponse, Position, TeamRoster } from "./models.js";

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const numberValue = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export function normalizePosition(raw: unknown): Position {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["g", "gk", "goalkeeper", "goleiro"].includes(value)) return "GK";
  if (["d", "def", "defender", "defensor", "zagueiro", "lateral"].includes(value)) return "DEF";
  if (["m", "mid", "midfielder", "meio-campista", "meia", "volante"].includes(value)) return "MID";
  if (["f", "fw", "fwd", "forward", "atacante", "centroavante", "ponta"].includes(value)) return "FWD";
  return "UNKNOWN";
}

function normalizeAthlete(raw: Record<string, unknown>): Athlete | null {
  const id = stringValue(raw.id);
  const name = stringValue(raw.displayName) ?? stringValue(raw.fullName);
  if (!id || !name) return null;

  const positionData = raw.position as Record<string, unknown> | undefined;
  const headshot = raw.headshot as Record<string, unknown> | undefined;
  return {
    id,
    name,
    shortName: stringValue(raw.shortName) ?? name,
    jersey: numberValue(Number(raw.jersey)) ?? null,
    position: normalizePosition(positionData?.abbreviation ?? positionData?.displayName ?? positionData?.name),
    positionLabel: stringValue(positionData?.displayName) ?? stringValue(positionData?.name),
    nationality: stringValue(raw.citizenship),
    age: numberValue(raw.age),
    dateOfBirth: stringValue(raw.dateOfBirth),
    heightCm: numberValue(raw.height) === null ? null : Math.round(Number(raw.height) * 2.54),
    weightKg: numberValue(raw.weight) === null ? null : Math.round(Number(raw.weight) * 0.453592),
    photoUrl: stringValue(headshot?.href)
  };
}

export function mapRoster(response: EspnRosterResponse, fallback: { id: string; name: string }): TeamRoster {
  const rawTeam = response.team ?? {};
  const athletes = (response.athletes ?? [])
    .map(normalizeAthlete)
    .filter((athlete): athlete is Athlete => athlete !== null);

  return {
    id: stringValue(rawTeam.id) ?? fallback.id,
    name: stringValue(rawTeam.displayName) ?? fallback.name,
    abbreviation: stringValue(rawTeam.abbreviation),
    logoUrl: stringValue(rawTeam.logo),
    athletes
  };
}

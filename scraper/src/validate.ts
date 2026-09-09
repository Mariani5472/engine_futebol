import type { RosterDataset } from "./models.js";

export function validateDataset(dataset: RosterDataset): string[] {
  const errors: string[] = [];
  if (dataset.season !== 2026) errors.push("A temporada do dataset deve ser 2026.");
  if (dataset.teams.length + dataset.failures.length !== 20) errors.push("O processamento deve conter os 20 clubes.");
  const teamIds = new Set<string>();
  for (const team of dataset.teams) {
    if (teamIds.has(team.id)) errors.push(`ID de clube duplicado: ${team.id}.`);
    teamIds.add(team.id);
    if (!team.name) errors.push(`Clube ${team.id} sem nome.`);
    const athleteIds = new Set<string>();
    for (const athlete of team.athletes) {
      if (athleteIds.has(athlete.id)) errors.push(`Atleta ${athlete.id} duplicado em ${team.name}.`);
      athleteIds.add(athlete.id);
      if (!athlete.name) errors.push(`Atleta ${athlete.id} sem nome em ${team.name}.`);
    }
  }
  return errors;
}

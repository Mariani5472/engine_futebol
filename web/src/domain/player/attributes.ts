import type { AverageAttributeOverview } from "@/domain/database.interface";
import { getNaturalRole, type TacticalRole } from "./overall";

export { getNaturalRole } from "./overall";

export function getCurrentPlayerAttributeOverview(
  attributes: AverageAttributeOverview[],
  naturalRole: TacticalRole,
): AverageAttributeOverview | undefined {
  const current = attributes.filter((attribute) => attribute.yearShift === 0);
  const source = current.length > 0 ? current : attributes;

  return (
    source.find((attribute) => {
      const position = attribute.position.toUpperCase();
      if (naturalRole === "GK") return position === "G" || position === "GK";
      return position === naturalRole;
    }) ?? source[0]
  );
}

export function getAttributeKeys(
  overview: AverageAttributeOverview,
  role: TacticalRole,
): Array<[string, number | string]> {
  const common = [
    ["Ataque", overview.attacking],
    ["Técnica", overview.technical],
    ["Tática", overview.tactical],
    ["Defesa", overview.defending],
    ["Criatividade", overview.creativity],
  ] as Array<[string, number | string]>;

  if (role === "GK") {
    return [
      ["Defesa", overview.defending],
      ["Tática", overview.tactical],
      ["Técnica", overview.technical],
      ["Criatividade", overview.creativity],
    ];
  }

  return common;
}

export function getNaturalRoleFromPlayer(
  position: string,
  positionsDetailed: string[],
): TacticalRole {
  return getNaturalRole(position, positionsDetailed);
}

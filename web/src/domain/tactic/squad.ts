import type { Athlete } from "@/domain/team/teams";

function isGoalkeeper(player: Athlete) {
  return (
    player.position === "G" ||
    player.position === "GK" ||
    player.positionsDetailed.includes("GK")
  );
}

function isDefender(player: Athlete) {
  return player.position === "D";
}

function isMidfielder(player: Athlete) {
  return player.position === "M";
}

function sortByStrength(a: Athlete, b: Athlete) {
  return (b.marketValue ?? 0) - (a.marketValue ?? 0);
}

function takeBest(
  players: Athlete[],
  predicate: (player: Athlete) => boolean,
  amount: number,
) {
  return players.filter(predicate).sort(sortByStrength).slice(0, amount);
}

export function buildInitialSquad(athletes: Athlete[]) {
  const goalkeeper = [...athletes]
    .filter(isGoalkeeper)
    .sort(sortByStrength)[0];

  const selected = goalkeeper ? [goalkeeper] : [];
  const selectedIds = new Set(selected.map((player) => player.id));
  const available = athletes.filter((player) => !selectedIds.has(player.id));

  // The default formation is 4-3-3, so build a sensible XI for it instead
  // of simply taking the first eleven players from the API response.
  const defenders = takeBest(available, isDefender, 4);
  const defenderIds = new Set(defenders.map((player) => player.id));

  const midfielders = takeBest(
    available.filter((player) => !defenderIds.has(player.id)),
    isMidfielder,
    3,
  );
  const midfielderIds = new Set(midfielders.map((player) => player.id));

  const forwards = takeBest(
    available.filter(
      (player) =>
        !defenderIds.has(player.id) && !midfielderIds.has(player.id),
    ),
    (player) => player.position === "F",
    3,
  );

  const starterIds = new Set([
    ...selected.map((player) => player.id),
    ...defenders.map((player) => player.id),
    ...midfielders.map((player) => player.id),
    ...forwards.map((player) => player.id),
  ]);

  const starters = [
    ...selected,
    ...defenders,
    ...midfielders,
    ...forwards,
  ];

  // Some squads may not have enough players in one position. Fill the
  // remaining slots with the strongest unused outfield players.
  if (starters.length < 11) {
    const remaining = available
      .filter((player) => !starterIds.has(player.id))
      .sort(sortByStrength);

    for (const player of remaining) {
      if (starters.length === 11) break;
      starters.push(player);
      starterIds.add(player.id);
    }
  }

  const bench = athletes.filter((player) => !starterIds.has(player.id));

  return {
    starters: starters.slice(0, 11).map((player) => player.id),
    bench: bench.map((player) => player.id),
  };
}

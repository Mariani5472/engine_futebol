import type { Fixture } from "./types";

function shuffle<T>(items: T[]) {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [
      result[j],
      result[i],
    ];
  }

  return result;
}

function generateFirstHalf(
  teamIds: string[],
): Fixture[] {
  if (teamIds.length % 2 !== 0) {
    throw new Error(
      "O número de times precisa ser par.",
    );
  }

  const teams = shuffle(teamIds);

  const fixtures: Fixture[] = [];

  const rounds = teams.length - 1;
  const matchesPerRound = teams.length / 2;

  /*
   * Método do círculo.
   *
   * O primeiro time permanece fixo.
   * Os demais rodam a cada rodada.
   */
  const fixedTeam = teams[0];
  let rotatingTeams = teams.slice(1);

  for (
    let round = 0;
    round < rounds;
    round++
  ) {
    const roundTeams = [
      fixedTeam,
      ...rotatingTeams,
    ];

    for (
      let match = 0;
      match < matchesPerRound;
      match++
    ) {
      const teamA =
        roundTeams[match];

      const teamB =
        roundTeams[
        roundTeams.length - 1 - match
        ];

      /*
       * Sorteia quem joga em casa.
       */
      const homeFirst =
        Math.random() < 0.5;

      fixtures.push({
        id: `R${round + 1}-${match + 1}`,
        round: round + 1,
        homeTeamId: homeFirst
          ? teamA
          : teamB,
        awayTeamId: homeFirst
          ? teamB
          : teamA,
        result: null,
      });
    }

    /*
     * Rotação dos times.
     */
    const last =
      rotatingTeams.pop();

    if (!last) {
      throw new Error(
        "Falha ao gerar rodada.",
      );
    }

    rotatingTeams.unshift(last);
  }

  return fixtures;
}

export function generateFixtures(
  teamIds: string[],
): Fixture[] {
  const firstHalf =
    generateFirstHalf(teamIds);

  const secondHalf =
    firstHalf.map((fixture) => ({
      ...fixture,

      id:
        `R${fixture.round +
        teamIds.length -
        1
        }-${fixture.id.split("-")[1]}-2`,

      round:
        fixture.round +
        teamIds.length -
        1,

      /*
       * Segundo turno inverte o mando.
       */
      homeTeamId:
        fixture.awayTeamId,

      awayTeamId:
        fixture.homeTeamId,

      result: null,
    }));

  return [
    ...firstHalf,
    ...secondHalf,
  ];
}

export function getFixturesByRound(
  fixtures: Fixture[],
  round: number,
) {
  return fixtures.filter(
    (fixture) =>
      fixture.round === round,
  );
}
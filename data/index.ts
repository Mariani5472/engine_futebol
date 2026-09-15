import { Builder, By, until, WebDriver } from "selenium-webdriver";
import fs from "node:fs/promises";
import path from "node:path";

const SOFASCORE = "https://www.sofascore.com";

const TOURNAMENT_PAGE =
  `${SOFASCORE}/pt/football/tournament/brazil/brasileirao-serie-a/325#id:87678,tab:standings`;

const STANDINGS_API =
  `${SOFASCORE}/api/v1/unique-tournament/325/season/87678/standings/total`;

const OUTPUT_FILE = path.join(
  process.cwd(),
  "brasileirao-2026.json"
);


// ============================================================
// TIPOS
// ============================================================

interface TeamBasic {
  country: unknown;
  gender: unknown;
  id: number;
  name: string;
  nameCode: string;
  national: boolean;
  shortName: string;
  slug: string;
  teamColors: unknown;
}

interface PlayerData {
  id: number;
  slug: string;
  dateOfBirth: unknown;
  height: unknown;
  jerseyNumber: unknown;
  name: string;
  position: unknown;
  positionsDetailed: unknown;
  preferredFoot: unknown;
  proposedMarketValueRaw: unknown;
  shirtNumber: unknown;
  shortName: string;
  sofascoreId: unknown;
  weight: unknown;
  country: unknown;

  averageAttributeOverviews?: unknown;
}

interface TeamData {
  country: unknown;
  foundationDateTimestamp: unknown;
  fullName: unknown;
  gender: unknown;
  id: number;
  manager: unknown;
  name: string;
  nameCode: unknown;
  national: unknown;
  teamColors: unknown;
  shortName: unknown;
  slug: string;
  venue: unknown;
}

interface TeamResult extends TeamBasic {
  team: TeamData;
  uniqueTournaments: unknown[];
  players: PlayerData[];
}

interface FinalData {
  tournament: {
    id: number;
    name: string;
  };

  teams: TeamResult[];
}


// ============================================================
// UTILIDADES
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// ============================================================
// LÊ JSON PELO PRÓPRIO NAVEGADOR
// ============================================================

async function getJson<T>(
  driver: WebDriver,
  url: string
): Promise<T> {

  console.log(`\n🌐 Acessando API:`);
  console.log(url);

  await driver.get(url);

  const body = await driver.wait(
    until.elementLocated(By.tagName("body")),
    15000
  );

  const text = await body.getText();

  if (!text) {
    throw new Error(`Resposta vazia da API: ${url}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("\n❌ Resposta não é JSON:");
    console.error(text.substring(0, 1000));

    throw new Error(
      `Não foi possível converter resposta em JSON: ${url}`
    );
  }
}


// ============================================================
// SALVAR CHECKPOINT
// ============================================================

async function saveJson(data: FinalData): Promise<void> {

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(data, null, 2),
    "utf-8"
  );

  console.log(`\n💾 JSON salvo em:`);
  console.log(OUTPUT_FILE);
}


// ============================================================
// STANDINGS
// ============================================================

interface StandingsResponse {
  standings: Array<{
    tournament: {
      id: number;
      name: string;
    };

    rows: Array<{
      team: TeamBasic;
    }>;
  }>;
}


async function getStandings(
  driver: WebDriver
): Promise<{
  tournament: {
    id: number;
    name: string;
  };

  teams: TeamBasic[];
}> {

  console.log("\n========================================");
  console.log("🏆 CAMPEONATO");
  console.log("========================================");

  // Primeiro acessamos a página normal do Brasileirão.
  console.log("\n📄 Abrindo página do Brasileirão...");

  await driver.get(TOURNAMENT_PAGE);

  await sleep(3000);

  console.log("✅ Página do Brasileirão carregada.");

  // Depois acessamos a API pelo navegador.
  const response = await getJson<StandingsResponse>(
    driver,
    STANDINGS_API
  );

  const standing = response.standings?.[0];

  if (!standing) {
    throw new Error(
      "standings[0] não encontrado na resposta."
    );
  }

  const tournament = {
    id: standing.tournament.id,
    name: standing.tournament.name
  };

  const teams: TeamBasic[] = standing.rows.map(
    row => ({
      country: row.team.country,
      gender: row.team.gender,
      id: row.team.id,
      name: row.team.name,
      nameCode: row.team.nameCode,
      national: row.team.national,
      shortName: row.team.shortName,
      slug: row.team.slug,
      teamColors: row.team.teamColors
    })
  );

  console.log(`\n🏆 Torneio: ${tournament.name}`);
  console.log(`🆔 ID: ${tournament.id}`);

  console.log(`\n⚽ Times encontrados: ${teams.length}`);

  for (const team of teams) {
    console.log(
      `   ${team.id} - ${team.name} (${team.slug})`
    );
  }

  if (teams.length !== 20) {
    console.warn(
      `\n⚠️ Esperávamos 20 times, mas foram encontrados ${teams.length}.`
    );
  }

  return {
    tournament,
    teams
  };
}


// ============================================================
// DADOS DO TIME
// ============================================================

interface TeamResponse {
  team: TeamData;
}

interface UniqueTournamentsResponse {
  uniqueTournaments: unknown[];
}

interface PlayersResponse {
  players: Array<{
    player: PlayerData;
  }>;
}


async function getTeam(
  driver: WebDriver,
  basicTeam: TeamBasic
): Promise<TeamResult> {

  console.log("\n========================================");
  console.log(`⚽ TIME: ${basicTeam.name}`);
  console.log(`🆔 ${basicTeam.id}`);
  console.log("========================================");

  const teamPage =
    `${SOFASCORE}/pt/football/team/${basicTeam.slug}/${basicTeam.id}`;

  // ----------------------------------------------------------
  // PÁGINA DO TIME
  // ----------------------------------------------------------

  console.log("\n📄 Abrindo página do time...");

  await driver.get(teamPage);

  await sleep(1500);

  console.log("✅ Página carregada.");

  // ----------------------------------------------------------
  // /team/{id}
  // ----------------------------------------------------------

  const teamResponse =
    await getJson<TeamResponse>(
      driver,
      `${SOFASCORE}/api/v1/team/${basicTeam.id}`
    );

  const team = {
    country: teamResponse.team.country,
    foundationDateTimestamp:
      teamResponse.team.foundationDateTimestamp,
    fullName: teamResponse.team.fullName,
    gender: teamResponse.team.gender,
    id: teamResponse.team.id,
    manager: teamResponse.team.manager,
    name: teamResponse.team.name,
    nameCode: teamResponse.team.nameCode,
    national: teamResponse.team.national,
    teamColors: teamResponse.team.teamColors,
    shortName: teamResponse.team.shortName,
    slug: teamResponse.team.slug,
    venue: teamResponse.team.venue
  };

  console.log(`\n✅ Dados do time obtidos.`);

  // ----------------------------------------------------------
  // /unique-tournaments
  // ----------------------------------------------------------

  console.log("\n🏆 Buscando torneios do time...");

  const tournamentsResponse =
    await getJson<UniqueTournamentsResponse>(
      driver,
      `${SOFASCORE}/api/v1/team/${basicTeam.id}/unique-tournaments`
    );

  const uniqueTournaments =
    tournamentsResponse.uniqueTournaments ?? [];

  console.log(
    `✅ ${uniqueTournaments.length} torneios encontrados.`
  );

  // ----------------------------------------------------------
  // /players
  // ----------------------------------------------------------

  console.log("\n👥 Buscando jogadores...");

  const playersResponse =
    await getJson<PlayersResponse>(
      driver,
      `${SOFASCORE}/api/v1/team/${basicTeam.id}/players`
    );

  const players: PlayerData[] =
    playersResponse.players.map(
      item => ({
        id: item.player.id,
        slug: item.player.slug,
        dateOfBirth: item.player.dateOfBirth,
        height: item.player.height,
        jerseyNumber: item.player.jerseyNumber,
        name: item.player.name,
        position: item.player.position,
        positionsDetailed: item.player.positionsDetailed,
        preferredFoot: item.player.preferredFoot,
        proposedMarketValueRaw:
          item.player.proposedMarketValueRaw,
        shirtNumber: item.player.shirtNumber,
        shortName: item.player.shortName,
        sofascoreId: item.player.sofascoreId,
        weight: item.player.weight,
        country: item.player.country
      })
    );

  console.log(
    `✅ ${players.length} jogadores encontrados.`
  );

  // ----------------------------------------------------------
  // RESULTADO INICIAL DO TIME
  // ----------------------------------------------------------

  const result: TeamResult = {
    ...basicTeam,
    team,
    uniqueTournaments,
    players
  };

  return result;
}


// ============================================================
// ATTRIBUTE OVERVIEWS
// ============================================================

interface AttributeOverviewResponse {
  averageAttributeOverviews: unknown;
}


async function getPlayerAttributes(
  driver: WebDriver,
  player: PlayerData
): Promise<unknown> {

  const playerPage =
    `${SOFASCORE}/pt/football/player/${player.slug}/${player.id}`;

  const attributeApi =
    `${SOFASCORE}/api/v1/player/${player.id}/attribute-overviews`;

  console.log(
    `\n   👤 ${player.name} (${player.id})`
  );

  // ----------------------------------------------------------
  // PÁGINA DO JOGADOR
  // ----------------------------------------------------------

  console.log("      📄 Abrindo página...");

  await driver.get(playerPage);

  // Pequena espera para a página começar a carregar.
  await sleep(1500);

  // ----------------------------------------------------------
  // SCROLL ATÉ O FINAL
  // ----------------------------------------------------------

  console.log("      ⬇️ Rolando página...");

  let previousHeight = 0;
  let attemptsWithoutChange = 0;

  while (attemptsWithoutChange < 3) {

    const currentHeight = await driver.executeScript(
      "return document.body.scrollHeight"
    ) as number;

    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight)"
    );

    await sleep(800);

    const newHeight = await driver.executeScript(
      "return document.body.scrollHeight"
    ) as number;

    if (newHeight === previousHeight) {
      attemptsWithoutChange++;
    } else {
      attemptsWithoutChange = 0;
    }

    previousHeight = newHeight;

    // Evita loop infinito.
    if (newHeight >= currentHeight) {
      // continua mais algumas vezes para dar
      // oportunidade de carregar conteúdo lazy
    }
  }

  console.log("      ✅ Final da página alcançado.");

  // ----------------------------------------------------------
  // ATTRIBUTE OVERVIEWS
  // ----------------------------------------------------------

  console.log(
    "      📊 Buscando attribute-overviews..."
  );

  const response =
    await getJson<AttributeOverviewResponse>(
      driver,
      attributeApi
    );

  console.log(
    "      ✅ averageAttributeOverviews obtido."
  );

  return response.averageAttributeOverviews;
}


// ============================================================
// PROCESSAR JOGADORES
// ============================================================

async function processPlayers(
  driver: WebDriver,
  team: TeamResult
): Promise<void> {

  console.log("\n----------------------------------------");
  console.log(`👥 PROCESSANDO JOGADORES: ${team.name}`);
  console.log("----------------------------------------");

  for (let i = 0; i < team.players.length; i++) {

    const player = team.players[i];
    if (!player) continue;

    console.log(
      `\n   [${i + 1}/${team.players.length}]`
    );

    try {

      player.averageAttributeOverviews =
        await getPlayerAttributes(
          driver,
          player
        );

    } catch (error) {

      console.error(
        `\n      ❌ Erro no jogador ${player.name}:`
      );

      console.error(error);

      // Não derruba o scraper inteiro.
      player.averageAttributeOverviews = null;
    }
  }
}


// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {

  let driver: WebDriver | undefined;

  try {

    console.log("========================================");
    console.log("🇧🇷 SOFASCORE — BRASILEIRÃO 2026");
    console.log("========================================");

    console.log("\n🚀 Iniciando Selenium + Microsoft Edge...");

    driver = await new Builder()
      .forBrowser("MicrosoftEdge")
      .build();

    await driver.manage().setTimeouts({
      implicit: 10000,
      pageLoad: 30000,
      script: 30000
    });

    console.log("✅ Edge iniciado.");

    // ========================================================
    // 1 → 5
    // ========================================================

    const standings = await getStandings(driver);

    const data: FinalData = {
      tournament: standings.tournament,
      teams: []
    };

    // Salva imediatamente.
    await saveJson(data);

    // ========================================================
    // 6 → PROCESSAR 20 TIMES
    // ========================================================

    for (let i = 0; i < standings.teams.length; i++) {

      const basicTeam = standings.teams[i];
      if (!basicTeam) continue;

      console.log("\n\n");
      console.log("########################################");
      console.log(
        `🏟️ TIME ${i + 1}/${standings.teams.length}`
      );
      console.log(
        `${basicTeam.name}`
      );
      console.log("########################################");

      try {

        const team = await getTeam(
          driver,
          basicTeam
        );

        // ----------------------------------------------------
        // 7 → JOGADORES
        // ----------------------------------------------------

        await processPlayers(
          driver,
          team
        );

        // ----------------------------------------------------
        // ADICIONA AO RESULTADO
        // ----------------------------------------------------

        data.teams.push(team);

        // ----------------------------------------------------
        // CHECKPOINT
        // ----------------------------------------------------

        await saveJson(data);

        console.log(
          `\n💾 Checkpoint salvo: ${data.teams.length}/${standings.teams.length} times.`
        );

      } catch (error) {

        console.error(
          `\n❌ Erro no time ${basicTeam.name}:`
        );

        console.error(error);

        // Continua para o próximo time.
      }
    }

    // ========================================================
    // FINAL
    // ========================================================

    await saveJson(data);

    console.log("\n========================================");
    console.log("🎉 SCRAPING FINALIZADO");
    console.log("========================================");

    console.log(
      `🏆 Torneio: ${data.tournament.name}`
    );

    console.log(
      `⚽ Times: ${data.teams.length}`
    );

    console.log(
      `👥 Jogadores: ${data.teams.reduce(
        (total, team) => total + team.players.length,
        0
      )
      }`
    );

    console.log(
      `\n📁 Arquivo: ${OUTPUT_FILE}`
    );

  } catch (error) {

    console.error("\n💥 ERRO FATAL:");
    console.error(error);

  } finally {

    if (driver) {

      console.log("\n🔒 Encerrando Edge...");

      await driver.quit();

      console.log("✅ Edge encerrado.");
    }
  }
}


// ============================================================
// EXECUÇÃO
// ============================================================

main();
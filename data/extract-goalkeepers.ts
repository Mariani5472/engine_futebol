// data/extract-goalkeepers.ts

import { Builder, By, until, WebDriver } from "selenium-webdriver";
import fs from "node:fs/promises";
import path from "node:path";

const SOFASCORE = "https://www.sofascore.com";

const INPUT_DIR = path.resolve(process.cwd(), "ai-overall");
const OUTPUT_FILE = path.resolve(INPUT_DIR, "goleiros.json");


// ============================================================
// TIPOS
// ============================================================

type SofaScoreOriginal = {
  ATT: number | null;
  CRE: number | null;
  TEC: number | null;
  DEF: number | null;
  TAC: number | null;

  // GK
  SAV: number | null;
  ANT: number | null;
  DIS: number | null;
  AER: number | null;
};

type Player = {
  id: number;
  nome: string;
  slug: string;
  posicao: string;
  valorMercado: number | null;
  idade: number | null;

  sofascoreOriginal: SofaScoreOriginal;

  sofascoreVazia: {
    ATT: number;
    CRE: number;
    TEC: number;
    DEF: number;
    TAC: number;
  };

  cartinhaFifa: {
    DIV: number;
    HAN: number;
    KIC: number;
    REF: number;
    SPD: number;
    POS: number;
  };

  desempenhoTotal2026: number;
};


// ============================================================
// SOFASCORE
// ============================================================

type AttributeOverviewResponse = {
  averageAttributeOverviews?: unknown;
};

function isGoalkeeper(position: string) {
  const normalized = position
    ? position.trim().toUpperCase()
    : "";

  return normalized === "G" || normalized === "GK";
}


function getAttribute(
  attributes: any,
  key: string,
): number | null {

  const value = attributes?.[key];

  if (typeof value !== "number") {
    return null;
  }

  return value;
}


// ============================================================
// LÊ JSON PELO NAVEGADOR
// ============================================================

async function getJson<T>(
  driver: WebDriver,
  url: string,
): Promise<T> {

  console.log(`\n🌐 ${url}`);

  await driver.get(url);

  const body = await driver.wait(
    until.elementLocated(By.tagName("body")),
    15000,
  );

  const text = await body.getText();

  if (!text) {
    throw new Error(`Resposta vazia: ${url}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    console.error(text.substring(0, 1000));

    throw new Error(
      `Resposta não é JSON: ${url}`,
    );
  }
}


// ============================================================
// BUSCAR ATRIBUTOS DO GOLEIRO
// ============================================================

async function getGoalkeeperAttributes(
  driver: WebDriver,
  player: Player,
): Promise<SofaScoreOriginal> {

  const playerPage =
    `${SOFASCORE}/pt/football/player/${player.slug}/${player.id}`;

  const attributeApi =
    `${SOFASCORE}/api/v1/player/${player.id}/attribute-overviews`;


  console.log(
    `\n🧤 ${player.nome} (${player.id})`,
  );

  // ----------------------------------------------------------
  // ABRE PÁGINA
  // ----------------------------------------------------------

  console.log("   📄 Abrindo página...");

  await driver.get(playerPage);

  await new Promise(resolve =>
    setTimeout(resolve, 1500),
  );


  // ----------------------------------------------------------
  // API
  // ----------------------------------------------------------

  console.log("   📊 Buscando atributos...");

  const response =
    await getJson<AttributeOverviewResponse>(
      driver,
      attributeApi,
    );


  const overview =
    response.averageAttributeOverviews as any;


  console.log(
    "   📦 Resposta recebida:",
    JSON.stringify(overview),
  );


  // ----------------------------------------------------------
  // GK
  // ----------------------------------------------------------

  /*
   * O SofaScore utiliza:
   *
   * saves
   * anticipation
   * tactical
   * ballDistribution
   * aerial
   *
   * para o perfil de goleiro.
   */

  const goalkeeper =
    overview?.goalkeeper ??
    overview?.GK ??
    overview;


  return {

    // jogadores de linha não são usados para GK
    ATT: getAttribute(
      goalkeeper,
      "attacking",
    ),

    CRE: getAttribute(
      goalkeeper,
      "creativity",
    ),

    TEC: getAttribute(
      goalkeeper,
      "technical",
    ),

    DEF: getAttribute(
      goalkeeper,
      "defending",
    ),

    TAC: getAttribute(
      goalkeeper,
      "tactical",
    ),

    SAV: getAttribute(
      goalkeeper,
      "saves",
    ),

    ANT: getAttribute(
      goalkeeper,
      "anticipation",
    ),

    DIS: getAttribute(
      goalkeeper,
      "ballDistribution",
    ),

    AER: getAttribute(
      goalkeeper,
      "aerial",
    ),
  };
}


// ============================================================
// MAIN
// ============================================================

async function main() {

  let driver: WebDriver | undefined;

  try {

    console.log(
      "========================================",
    );

    console.log(
      "🧤 EXTRAINDO GOLEIROS",
    );

    console.log(
      "========================================",
    );


    // --------------------------------------------------------
    // ARQUIVOS
    // --------------------------------------------------------

    const files = (
      await fs.readdir(INPUT_DIR)
    ).filter(
      file =>
        file.endsWith(".json") &&
        file !== "goleiros.json",
    );


    const goalkeepers: Player[] = [];


    // --------------------------------------------------------
    // LER TIMES
    // --------------------------------------------------------

    for (const file of files) {

      const filePath =
        path.join(INPUT_DIR, file);

      const content =
        await fs.readFile(
          filePath,
          "utf-8",
        );

      const json =
        JSON.parse(content);

      const players: Player[] =
        json.jogadores ?? [];


      for (const player of players) {

        if (
          !isGoalkeeper(player.posicao)
        ) {
          continue;
        }

        goalkeepers.push({
          ...player,

          cartinhaFifa: {
            DIV: 0,
            HAN: 0,
            KIC: 0,
            REF: 0,
            SPD: 0,
            POS: 0,
          },
        });
      }
    }


    console.log(
      `\n🧤 ${goalkeepers.length} goleiros encontrados.`,
    );


    // --------------------------------------------------------
    // SELENIUM
    // --------------------------------------------------------

    driver = await new Builder()
      .forBrowser("MicrosoftEdge")
      .build();

    await driver.manage().setTimeouts({
      implicit: 10000,
      pageLoad: 30000,
      script: 30000,
    });


    // --------------------------------------------------------
    // PROCESSAR
    // --------------------------------------------------------

    for (
      let i = 0;
      i < goalkeepers.length;
      i++
    ) {

      const player =
        goalkeepers[i];

      if (!player) {
        continue;
      }


      console.log(
        `\n[${i + 1}/${goalkeepers.length}]`,
      );


      try {

        player.sofascoreOriginal =
          await getGoalkeeperAttributes(
            driver,
            player,
          );


        console.log(
          "   ✅ Atributos salvos:",
        );

        console.log(
          player.sofascoreOriginal,
        );

      } catch (error) {

        console.error(
          `   ❌ Erro em ${player.nome}`,
        );

        console.error(error);

        // Mantém o que já existia
      }
    }


    // --------------------------------------------------------
    // ORDENAR
    // --------------------------------------------------------

    goalkeepers.sort(
      (a, b) =>
        a.nome.localeCompare(
          b.nome,
          "pt-BR",
        ),
    );


    // --------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------

    await fs.writeFile(
      OUTPUT_FILE,
      JSON.stringify(
        goalkeepers,
        null,
        2,
      ),
      "utf-8",
    );


    console.log(
      "\n========================================",
    );

    console.log(
      "✅ FINALIZADO",
    );

    console.log(
      "========================================",
    );

    console.log(
      `🧤 Goleiros: ${goalkeepers.length}`,
    );

    console.log(
      `📄 ${OUTPUT_FILE}`,
    );

  } finally {

    if (driver) {

      console.log(
        "\n🔒 Encerrando Edge...",
      );

      await driver.quit();
    }
  }
}


main();
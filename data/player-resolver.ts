import {
  Builder,
  By,
  until,
  WebDriver
} from "selenium-webdriver";

import fs from "node:fs/promises";
import path from "node:path";


// ============================================================
// ARQUIVOS
// ============================================================

const MAIN_FILE = path.join(
  process.cwd(),
  "brasileirao-2026.json"
);

const ERRORS_FILE = path.join(
  process.cwd(),
  "players-erros.json"
);


// ============================================================
// SOFASCORE
// ============================================================

const SOFASCORE =
  "https://www.sofascore.com";


// ============================================================
// TIPOS
// ============================================================

interface Player {

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


interface Team {

  id: number;

  name: string;

  slug: string;

  players: Player[];
}


interface BrasileiraoData {

  tournament: {
    id: number;
    name: string;
  };

  teams: Team[];
}


interface PlayerError {

  teamId: number;

  teamName: string;

  teamSlug: string;

  playerId: number;

  playerName: string;

  playerSlug: string;

  playerUrl: string;

  attributeUrl: string;
}


interface AttributeResponse {

  averageAttributeOverviews: unknown;
}


// ============================================================
// CONFIGURAÇÕES
// ============================================================

const PLAYER_ATTEMPTS = 3;


// ============================================================
// SLEEP
// ============================================================

function sleep(
  ms: number
): Promise<void> {

  return new Promise(
    resolve => setTimeout(resolve, ms)
  );
}


// ============================================================
// CARREGAR JSON
// ============================================================

async function loadJson<T>(
  file: string
): Promise<T> {

  const content =
    await fs.readFile(
      file,
      "utf-8"
    );

  return JSON.parse(content);
}


// ============================================================
// SALVAR JSON
// ============================================================

async function saveJson<T>(
  file: string,
  data: T
): Promise<void> {

  await fs.writeFile(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf-8"
  );
}


// ============================================================
// ACESSAR API PELO EDGE
// ============================================================

async function getJson<T>(
  driver: WebDriver,
  url: string
): Promise<T> {

  await driver.get(url);

  const body =
    await driver.wait(
      until.elementLocated(
        By.tagName("body")
      ),
      15000
    );

  const text =
    await body.getText();

  if (!text) {

    throw new Error(
      "Resposta vazia."
    );
  }


  // ----------------------------------------------------------
  // DETECTAR ERROS VARNISH
  // ----------------------------------------------------------

  const lower =
    text.toLowerCase();

  if (
    lower.includes(
      "backend read error"
    ) ||
    lower.includes(
      "varnish cache server"
    ) ||
    lower.includes(
      "error 503"
    ) ||
    lower.includes(
      "error 502"
    ) ||
    lower.includes(
      "error 504"
    )
  ) {

    throw new Error(
      `SofaScore retornou erro do backend: \n${text.substring(0, 500)} `
    );
  }


  // ----------------------------------------------------------
  // JSON
  // ----------------------------------------------------------

  try {

    return JSON.parse(
      text
    ) as T;

  } catch {

    throw new Error(
      `Resposta não é JSON: \n${text.substring(0, 500)} `
    );
  }
}


// ============================================================
// SCROLL
// ============================================================

async function scrollToBottom(
  driver: WebDriver
): Promise<void> {

  let lastHeight = 0;

  let stableCount = 0;


  while (stableCount < 3) {

    const height =
      await driver.executeScript(
        "return document.body.scrollHeight"
      ) as number;


    await driver.executeScript(
      "window.scrollTo(0, document.body.scrollHeight)"
    );


    await sleep(1000);


    const newHeight =
      await driver.executeScript(
        "return document.body.scrollHeight"
      ) as number;


    if (
      newHeight === lastHeight
    ) {

      stableCount++;

    } else {

      stableCount = 0;
    }


    lastHeight =
      newHeight;


    // Segurança contra páginas absurdamente grandes.
    if (
      height > 5000000
    ) {

      break;
    }
  }
}


// ============================================================
// ATTRIBUTE OVERVIEWS
// ============================================================

async function resolvePlayer(
  driver: WebDriver,
  player: PlayerError
): Promise<unknown> {

  console.log(
    `\n   👤 ${player.playerName} `
  );

  console.log(
    `      ID: ${player.playerId} `
  );


  // ----------------------------------------------------------
  // PÁGINA DO PLAYER
  // ----------------------------------------------------------

  console.log(
    "      📄 Abrindo página..."
  );

  await driver.get(
    player.playerUrl
  );


  await sleep(1500);


  // ----------------------------------------------------------
  // SCROLL
  // ----------------------------------------------------------

  console.log(
    "      ⬇️ Scroll..."
  );

  await scrollToBottom(
    driver
  );


  // Dá um pequeno tempo para requests lazy.
  await sleep(1500);


  // ----------------------------------------------------------
  // ATTRIBUTE API
  // ----------------------------------------------------------

  console.log(
    "      📊 Abrindo attribute-overviews..."
  );

  const response =
    await getJson<AttributeResponse>(
      driver,
      player.attributeUrl
    );


  if (
    response.averageAttributeOverviews ===
    undefined ||
    response.averageAttributeOverviews ===
    null
  ) {

    throw new Error(
      "averageAttributeOverviews não encontrado."
    );
  }


  console.log(
    "      ✅ Resolvido!"
  );


  return response.averageAttributeOverviews;
}


// ============================================================
// RETRY
// ============================================================

async function resolveWithRetry(
  driver: WebDriver,
  player: PlayerError
): Promise<unknown> {

  let lastError: unknown;


  for (
    let attempt = 1;
    attempt <= PLAYER_ATTEMPTS;
    attempt++
  ) {

    console.log(
      `\n      🔄 Tentativa ${attempt}/${PLAYER_ATTEMPTS}`
    );


    try {

      return await resolvePlayer(
        driver,
        player
      );

    } catch (error) {

      lastError =
        error;


      console.log(
        `      ❌ Falhou.`
      );


      if (
        error instanceof Error
      ) {

        console.log(
          `      ${error.message.substring(0, 300)}`
        );
      }


      if (
        attempt < PLAYER_ATTEMPTS
      ) {

        const wait =
          attempt === 1
            ? 3000
            : 7000;


        console.log(
          `      ⏳ Esperando ${wait / 1000}s...`
        );


        await sleep(
          wait
        );
      }
    }
  }


  throw lastError;
}


// ============================================================
// ENCONTRAR PLAYER NO JSON PRINCIPAL
// ============================================================

function findPlayer(
  data: BrasileiraoData,
  playerId: number
): Player | undefined {

  for (
    const team of data.teams
  ) {

    const player =
      team.players.find(
        player =>
          player.id === playerId
      );


    if (player) {

      return player;
    }
  }


  return undefined;
}


// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {

  console.log(
    "========================================"
  );

  console.log(
    "🔧 PLAYER RESOLVER"
  );

  console.log(
    "========================================"
  );


  // ==========================================================
  // CARREGAR
  // ==========================================================

  const data =
    await loadJson<BrasileiraoData>(
      MAIN_FILE
    );


  const errors =
    await loadJson<PlayerError[]>(
      ERRORS_FILE
    );


  console.log(
    `\n📊 Players pendentes: ${errors.length}`
  );


  if (
    errors.length === 0
  ) {

    console.log(
      "\n🎉 Não existem players pendentes."
    );

    return;
  }


  // ==========================================================
  // EDGE
  // ==========================================================

  console.log(
    "\n🚀 Iniciando Microsoft Edge..."
  );


  const driver =
    await new Builder()
      .forBrowser(
        "MicrosoftEdge"
      )
      .build();


  await driver.manage()
    .setTimeouts({
      implicit: 10000,
      pageLoad: 30000,
      script: 30000
    });


  console.log(
    "✅ Edge iniciado."
  );


  // ==========================================================
  // PENDENTES RESTANTES
  // ==========================================================

  const stillErrors:
    PlayerError[] = [];


  let resolved = 0;


  try {

    // ========================================================
    // PLAYERS
    // ========================================================

    for (
      let i = 0;
      i < errors.length;
      i++
    ) {

      const player =
        errors[i];
      if (!player) continue;


      console.log(
        "\n========================================"
      );

      console.log(
        `👤 PLAYER ${i + 1}/${errors.length}`
      );

      console.log(
        `${player.playerName} — ${player.teamName}`
      );

      console.log(
        "========================================"
      );


      // ------------------------------------------------------
      // ENCONTRAR NO JSON PRINCIPAL
      // ------------------------------------------------------

      const mainPlayer =
        findPlayer(
          data,
          player.playerId
        );


      if (!mainPlayer) {

        console.log(
          "❌ Player não encontrado no JSON principal."
        );

        stillErrors.push(
          player
        );

        continue;
      }


      // ------------------------------------------------------
      // JÁ RESOLVIDO?
      // ------------------------------------------------------

      if (
        mainPlayer.averageAttributeOverviews !==
        undefined &&
        mainPlayer.averageAttributeOverviews !==
        null
      ) {

        console.log(
          "⏭️ Já possui attributes. Pulando."
        );

        resolved++;

        continue;
      }


      // ------------------------------------------------------
      // RESOLVER
      // ------------------------------------------------------

      try {

        const attributes =
          await resolveWithRetry(
            driver,
            player
          );


        mainPlayer.averageAttributeOverviews =
          attributes;


        resolved++;


        // ----------------------------------------------------
        // CHECKPOINT
        // ----------------------------------------------------

        await saveJson(
          MAIN_FILE,
          data
        );


        console.log(
          `\n💾 brasileirao-2026.json atualizado.`
        );


      } catch (error) {

        console.log(
          `\n❌ Não foi possível resolver ${player.playerName}.`
        );


        if (
          error instanceof Error
        ) {

          console.log(
            error.message.substring(
              0,
              500
            )
          );
        }


        stillErrors.push(
          player
        );
      }


      // Pequeno intervalo entre jogadores.
      await sleep(1000);
    }


  } finally {

    console.log(
      "\n🔒 Encerrando Edge..."
    );


    await driver.quit();

    console.log(
      "✅ Edge encerrado."
    );
  }


  // ==========================================================
  // ATUALIZAR PLAYERS-ERROS.JSON
  // ==========================================================

  await saveJson(
    ERRORS_FILE,
    stillErrors
  );


  // ==========================================================
  // RESULTADO
  // ==========================================================

  console.log(
    "\n\n========================================"
  );

  console.log(
    "📊 RESOLUÇÃO FINAL"
  );

  console.log(
    "========================================"
  );


  console.log(
    `📥 Pendentes inicialmente: ${errors.length}`
  );

  console.log(
    `✅ Resolvidos: ${resolved}`
  );

  console.log(
    `❌ Ainda pendentes: ${stillErrors.length}`
  );


  console.log(
    `\n💾 JSON principal atualizado:`
  );

  console.log(
    MAIN_FILE
  );


  console.log(
    `\n💾 Pendentes restantes:`
  );

  console.log(
    ERRORS_FILE
  );


  if (
    stillErrors.length === 0
  ) {

    console.log(
      "\n🎉 TODOS OS PLAYERS FORAM RESOLVIDOS!"
    );

  } else {

    console.log(
      `\n⚠️ Ainda existem ${stillErrors.length} players pendentes.`
    );

    console.log(
      "Execute novamente:"
    );

    console.log(
      "npx tsx player-resolver.ts"
    );
  }
}


// ============================================================
// EXECUTAR
// ============================================================

main().catch(error => {

  console.error(
    "\n💥 ERRO FATAL:"
  );

  console.error(
    error
  );

  process.exit(1);
});

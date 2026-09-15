import { Builder, By, until, type WebDriver } from "selenium-webdriver";
import fs from "node:fs/promises";
import path from "node:path";

type Player = {
  id: number;
  slug: string;
  playerAttributeOverviews?: unknown;
  averageAttributeOverviews?: unknown;
};

type Team = {
  players: Player[];
  [key: string]: unknown;
};

type Database = {
  tournament: unknown;
  teams: Team[];
};

type AttributeResponse = {
  playerAttributeOverviews?: unknown;
  averageAttributeOverviews?: unknown;
};

const SOFASCORE = "https://www.sofascore.com";
const DATABASE_FILES = [
  path.resolve(process.cwd(), "brasileirao-2026.json"),
  path.resolve(process.cwd(), "../web/database/game-database.json"),
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getJson<T>(driver: WebDriver, url: string): Promise<T> {
  await driver.get(url);

  const body = await driver.wait(
    until.elementLocated(By.tagName("body")),
    15000,
  );

  const text = await body.getText();
  if (!text) throw new Error(`Resposta vazia: ${url}`);

  return JSON.parse(text) as T;
}

async function saveDatabase(data: Database) {
  const content = JSON.stringify(data, null, 2);

  for (const file of DATABASE_FILES) {
    await fs.writeFile(file, content, "utf-8");
    console.log(`💾 ${file}`);
  }
}

async function main() {
  const sourceFile = DATABASE_FILES[0];
  const raw = await fs.readFile(sourceFile, "utf-8");
  const data = JSON.parse(raw) as Database;

  let driver: WebDriver | undefined;

  try {
    driver = await new Builder().forBrowser("MicrosoftEdge").build();
    await driver.manage().setTimeouts({
      implicit: 10000,
      pageLoad: 30000,
      script: 30000,
    });

    const players = data.teams.flatMap((team) => team.players);
    console.log(`👥 Jogadores: ${players.length}`);

    for (let index = 0; index < players.length; index++) {
      const player = players[index];
      if (!player) continue;

      console.log(`[${index + 1}/${players.length}] ${player.slug}`);

      try {
        const response = await getJson<AttributeResponse>(
          driver,
          `${SOFASCORE}/api/v1/player/${player.id}/attribute-overviews`,
        );

        player.playerAttributeOverviews =
          response.playerAttributeOverviews ?? null;

        player.averageAttributeOverviews =
          response.averageAttributeOverviews ?? null;
      } catch (error) {
        console.error(`❌ ${player.id}`, error);
        player.playerAttributeOverviews = null;
      }

      if ((index + 1) % 10 === 0) {
        await saveDatabase(data);
      }

      await sleep(250);
    }

    await saveDatabase(data);
    console.log("🎉 Atributos individuais atualizados.");
  } finally {
    await driver?.quit();
  }
}

main().catch((error) => {
  console.error("💥 Erro fatal:", error);
  process.exitCode = 1;
});

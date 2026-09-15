import { Builder, By, until, type WebDriver } from "selenium-webdriver";
import fs from "node:fs/promises";
import path from "node:path";

type SofaScoreAttributeOverview = {
  id?: number;
  position?: string;
  yearShift?: number;
  attacking?: number;
  technical?: number;
  tactical?: number;
  defending?: number;
  creativity?: number;
  saves?: number;
  anticipation?: number;
  ballDistribution?: number;
  aerial?: number;
};

type Player = {
  id: number;
  name: string;
  slug?: string;
  position?: string;
  positionsDetailed?: string[];
  proposedMarketValue?: number;
  dateOfBirth?: string;
  playerAttributeOverviews?: SofaScoreAttributeOverview[] | null;
};

type Team = {
  id?: number;
  name: string;
  slug?: string;
  players: Player[];
};

type Database = {
  teams: Team[];
};

type AttributeResponse = {
  playerAttributeOverviews?: SofaScoreAttributeOverview[];
};

type AiPlayerInput = {
  id: number;
  nome: string;
  slug: string | null;
  posicao: string | null;
  valorMercado: number | null;
  idade: number | null;
  sofascoreOriginal: {
    ATT: number | null;
    CRE: number | null;
    TEC: number | null;
    DEF: number | null;
    TAC: number | null;
    // Para goleiros, o script também preserva os cinco atributos específicos.
    SAV: number | null;
    ANT: number | null;
    DIS: number | null;
    AER: number | null;
  };
  sofascoreVazia: {
    ATT: number;
    CRE: number;
    TEC: number;
    DEF: number;
    TAC: number;
  };
  cartinhaFifa: {
    PAC: number;
    SHO: number;
    PAS: number;
    DRI: number;
    DEF: number;
    PHY: number;
  };
  desempenhoTotal2026: number;
};

const SOURCE_FILE = path.resolve(process.cwd(), "brasileirao-2026.json");
const OUTPUT_DIR = path.resolve(process.cwd(), "ai-overall");
const SOFASCORE = "https://www.sofascore.com";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calculateAge(dateOfBirth?: string) {
  if (!dateOfBirth) return null;

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;

  const reference = new Date("2026-08-01T00:00:00Z");
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();

  const month = reference.getUTCMonth() - birth.getUTCMonth();
  const day = reference.getUTCDate() - birth.getUTCDate();

  if (month < 0 || (month === 0 && day < 0)) {
    age -= 1;
  }

  return age;
}

function currentAttribute(
  attributes: SofaScoreAttributeOverview[] | null | undefined,
) {
  if (!attributes?.length) return undefined;

  return (
    attributes.find((attribute) => attribute.yearShift === 0) ??
    attributes[0]
  );
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildPlayer(
  player: Player,
  fetchedAttributes?: SofaScoreAttributeOverview[] | null,
): AiPlayerInput {
  const attribute = currentAttribute(
    fetchedAttributes ?? player.playerAttributeOverviews,
  );

  return {
    id: player.id,
    nome: player.name,
    slug: player.slug ?? null,
    posicao: player.positionsDetailed?.join("/") ?? player.position ?? null,
    valorMercado: numberOrNull(player.proposedMarketValue),
    idade: calculateAge(player.dateOfBirth),

    sofascoreOriginal: {
      ATT: numberOrNull(attribute?.attacking),
      CRE: numberOrNull(attribute?.creativity),
      TEC: numberOrNull(attribute?.technical),
      DEF: numberOrNull(attribute?.defending),
      TAC: numberOrNull(attribute?.tactical),
      SAV: numberOrNull(attribute?.saves),
      ANT: numberOrNull(attribute?.anticipation),
      DIS: numberOrNull(attribute?.ballDistribution),
      AER: numberOrNull(attribute?.aerial),
    },

    sofascoreVazia: {
      ATT: 0,
      CRE: 0,
      TEC: 0,
      DEF: 0,
      TAC: 0,
    },

    cartinhaFifa: {
      PAC: 0,
      SHO: 0,
      PAS: 0,
      DRI: 0,
      DEF: 0,
      PHY: 0,
    },

    desempenhoTotal2026: 0,
  };
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

async function main() {
  const raw = await fs.readFile(SOURCE_FILE, "utf-8");
  const database = JSON.parse(raw) as Database;

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  let driver: WebDriver | undefined;

  try {
    driver = await new Builder().forBrowser("MicrosoftEdge").build();
    await driver.manage().setTimeouts({
      implicit: 10000,
      pageLoad: 30000,
      script: 30000,
    });

    let total = 0;

    for (const team of database.teams) {
      const players: AiPlayerInput[] = [];

      console.log(`\\n🏟️ ${team.name} — ${team.players.length} jogadores`);

      for (let index = 0; index < team.players.length; index += 1) {
        const player = team.players[index];
        if (!player) continue;

        console.log(
          `[${index + 1}/${team.players.length}] ${player.name}`,
        );

        let attributes = player.playerAttributeOverviews ?? null;

        try {
          const response = await getJson<AttributeResponse>(
            driver,
            `${SOFASCORE}/api/v1/player/${player.id}/attribute-overviews`,
          );

          attributes = response.playerAttributeOverviews ?? null;
        } catch (error) {
          console.warn(
            `⚠️ Não foi possível atualizar SofaScore para ${player.name} (${player.id}). Usando dados salvos.`,
          );
        }

        players.push(buildPlayer(player, attributes));
        total += 1;

        await sleep(250);
      }

      const output = {
        time: {
          id: team.id ?? null,
          nome: team.name,
          slug: team.slug ?? slugify(team.name),
        },
        temporada: 2026,
        jogadores: players,
      };

      const fileName = `${slugify(team.slug ?? team.name)}.json`;
      const outputFile = path.join(OUTPUT_DIR, fileName);

      await fs.writeFile(
        outputFile,
        JSON.stringify(output, null, 2),
        "utf-8",
      );

      console.log(`💾 ${outputFile}`);
    }

    console.log(`\\n🎉 ${total} jogadores preparados para enriquecimento por IA.`);
    console.log(`📁 Arquivos separados por time: ${OUTPUT_DIR}`);
  } finally {
    await driver?.quit();
  }
}

main().catch((error) => {
  console.error("💥 Erro fatal:", error);
  process.exitCode = 1;
});

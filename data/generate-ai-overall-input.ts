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

type SourcePlayer = {
  id: number;
  name: string;
  slug?: string;
  position?: string;
  positionsDetailed?: string[];
  proposedMarketValue?: number;
  proposedMarketValueRaw?: number;
  dateOfBirth?: string;
  averageAttributeOverviews?: SofaScoreAttributeOverview[] | null;
  playerAttributeOverviews?: SofaScoreAttributeOverview[] | null;
};

type SourceTeam = {
  id?: number;
  name: string;
  slug?: string;
  players: SourcePlayer[];
};

type SourceDatabase = {
  teams: SourceTeam[];
};

type AttributeResponse = {
  playerAttributeOverviews?: SofaScoreAttributeOverview[] | null;
  averageAttributeOverviews?: SofaScoreAttributeOverview[] | null;
};

type AiPlayer = {
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
    SAV: number | null;
    ANT: number | null;
    DIS: number | null;
    AER: number | null;
  };
  sofascoreVazia: Record<string, number>;
  cartinhaFifa: Record<string, number>;
  desempenhoTotal2026: number;
};

type AiTeamFile = {
  time: {
    id: number | null;
    nome: string;
    slug: string;
  };
  temporada: number;
  jogadores: AiPlayer[];
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

  if (month < 0 || (month === 0 && day < 0)) age -= 1;

  return age;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isGoalkeeper(position?: string | null) {
  const normalized = (position ?? "").toUpperCase();
  return normalized === "G" || normalized === "GK" || normalized === "GL";
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

function buildSofascoreOriginal(
  attribute: SofaScoreAttributeOverview | undefined,
): AiPlayer["sofascoreOriginal"] {
  return {
    ATT: numberOrNull(attribute?.attacking),
    CRE: numberOrNull(attribute?.creativity),
    TEC: numberOrNull(attribute?.technical),
    DEF: numberOrNull(attribute?.defending),
    TAC: numberOrNull(attribute?.tactical),
    SAV: numberOrNull(attribute?.saves),
    ANT: numberOrNull(attribute?.anticipation),
    DIS: numberOrNull(attribute?.ballDistribution),
    AER: numberOrNull(attribute?.aerial),
  };
}

function buildBasePlayer(player: SourcePlayer): AiPlayer {
  return {
    id: player.id,
    nome: player.name,
    slug: player.slug ?? null,
    posicao: player.positionsDetailed?.join("/") ?? player.position ?? null,
    valorMercado: numberOrNull(
      player.proposedMarketValue ?? player.proposedMarketValueRaw,
    ),
    idade: calculateAge(player.dateOfBirth),
    sofascoreOriginal: buildSofascoreOriginal(
      currentAttribute(player.playerAttributeOverviews),
    ),
    sofascoreVazia: {
      ATT: 0,
      CRE: 0,
      TEC: 0,
      DEF: 0,
      TAC: 0,
    },
    cartinhaFifa: isGoalkeeper(player.position)
      ? {
          DIV: 0,
          HAN: 0,
          KIC: 0,
          REF: 0,
          SPD: 0,
          POS: 0,
        }
      : {
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

function mergeWithExisting(
  generated: AiPlayer,
  existing: AiPlayer | undefined,
): AiPlayer {
  if (!existing) return generated;

  return {
    ...generated,
    // Os três campos abaixo são dados produzidos pela IA e NÃO devem ser
    // perdidos quando o SofaScore for atualizado.
    sofascoreVazia: existing.sofascoreVazia,
    cartinhaFifa: existing.cartinhaFifa,
    desempenhoTotal2026: existing.desempenhoTotal2026,
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

async function loadExistingTeam(
  file: string,
): Promise<AiTeamFile | null> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as AiTeamFile;
  } catch {
    return null;
  }
}

async function main() {
  const raw = await fs.readFile(SOURCE_FILE, "utf-8");
  const database = JSON.parse(raw) as SourceDatabase;

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
    let goalkeepers = 0;

    for (const team of database.teams) {
      const fileName = `${slugify(team.slug ?? team.name)}.json`;
      const outputFile = path.join(OUTPUT_DIR, fileName);
      const existing = await loadExistingTeam(outputFile);
      const existingById = new Map(
        (existing?.jogadores ?? []).map((player) => [player.id, player]),
      );

      const players: AiPlayer[] = [];

      console.log(`\\n🏟️ ${team.name} — ${team.players.length} jogadores`);

      for (let index = 0; index < team.players.length; index += 1) {
        const sourcePlayer = team.players[index];
        if (!sourcePlayer) continue;

        const goalkeeper = isGoalkeeper(sourcePlayer.position);
        if (goalkeeper) goalkeepers += 1;

        console.log(
          `[${index + 1}/${team.players.length}] ${sourcePlayer.name}${goalkeeper ? " 🧤" : ""}`,
        );

        let playerAttributes = sourcePlayer.playerAttributeOverviews ?? null;
        let averageAttributes = sourcePlayer.averageAttributeOverviews ?? null;

        try {
          const response = await getJson<AttributeResponse>(
            driver,
            `${SOFASCORE}/api/v1/player/${sourcePlayer.id}/attribute-overviews`,
          );

          playerAttributes = response.playerAttributeOverviews ?? null;
          averageAttributes = response.averageAttributeOverviews ?? null;
        } catch {
          console.warn(
            `⚠️ SofaScore não atualizado para ${sourcePlayer.name}; usando os dados salvos.`,
          );
        }

        // Para jogadores de linha usamos o atributo individual.
        // Para GK, o SofaScore pode não fornecer playerAttributeOverviews;
        // nesse caso usamos o averageAttributeOverviews, que contém o bloco
        // específico de goleiro (SAV/ANT/TAC/DIS/AER).
        const selectedAttributes = goalkeeper
          ? currentAttribute(averageAttributes) ?? currentAttribute(playerAttributes)
          : currentAttribute(playerAttributes) ?? currentAttribute(averageAttributes);

        const generated = buildBasePlayer({
          ...sourcePlayer,
          playerAttributeOverviews: selectedAttributes ? [selectedAttributes] : null,
        });

        const merged = mergeWithExisting(
          generated,
          existingById.get(sourcePlayer.id),
        );

        // Mantém o formato especial da cartinha dos GK já preenchida pela IA.
        if (goalkeeper) {
          const existingFifa = existingById.get(sourcePlayer.id)?.cartinhaFifa;

          merged.cartinhaFifa = existingFifa ?? {
            DIV: 0,
            HAN: 0,
            KIC: 0,
            REF: 0,
            SPD: 0,
            POS: 0,
          };
        }

        players.push(merged);
        total += 1;

        await sleep(250);
      }

      const output: AiTeamFile = {
        time: {
          id: team.id ?? null,
          nome: team.name,
          slug: team.slug ?? slugify(team.name),
        },
        temporada: 2026,
        jogadores: players,
      };

      await fs.writeFile(
        outputFile,
        JSON.stringify(output, null, 2),
        "utf-8",
      );

      console.log(`💾 ${outputFile}`);
    }

    console.log(`\\n🎉 ${total} jogadores atualizados.`);
    console.log(`🧤 Goleiros tratados: ${goalkeepers}`);
    console.log(`📁 ${OUTPUT_DIR}`);
  } finally {
    await driver?.quit();
  }
}

main().catch((error) => {
  console.error("💥 Erro fatal:", error);
  process.exitCode = 1;
});

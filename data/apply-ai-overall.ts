import fs from "node:fs/promises";
import path from "node:path";

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

type MainPlayer = {
  id: number;
  [key: string]: unknown;
};

type MainTeam = {
  id: number;
  slug: string;
  players: MainPlayer[];
  [key: string]: unknown;
};

type MainDatabase = {
  tournament: unknown;
  teams: MainTeam[];
  [key: string]: unknown;
};

type OverallData = {
  sofascoreOriginal: AiPlayer["sofascoreOriginal"];
  sofascoreVazia: AiPlayer["sofascoreVazia"];
  cartinhaFifa: AiPlayer["cartinhaFifa"];
  desempenhoTotal2026: number;
};

const MAIN_FILE = path.resolve(process.cwd(), "brasileirao-2026.json");
const AI_DIR = path.resolve(process.cwd(), "ai-overall");
const WEB_DATABASE_FILE = path.resolve(
  process.cwd(),
  "../web/database/game-database.json",
);

async function loadJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as T;
}

async function saveJson(file: string, data: unknown) {
  await fs.writeFile(
    file,
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}

async function main() {
  console.log("========================================");
  console.log("🧩 APLICANDO AI OVERALL");
  console.log("========================================");

  const database = await loadJson<MainDatabase>(MAIN_FILE);

  const aiFiles = (await fs.readdir(AI_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const aiPlayers = new Map<number, AiPlayer>();

  for (const file of aiFiles) {
    const aiTeam = await loadJson<AiTeamFile>(
      path.join(AI_DIR, file),
    );

    for (const player of aiTeam.jogadores) {
      aiPlayers.set(player.id, player);
    }
  }

  console.log(`📁 Arquivos AI: ${aiFiles.length}`);
  console.log(`👥 Jogadores AI: ${aiPlayers.size}`);

  let updated = 0;
  let missing = 0;

  for (const team of database.teams) {
    for (const player of team.players) {
      const aiPlayer = aiPlayers.get(player.id);

      if (!aiPlayer) {
        missing += 1;
        console.warn(
          `⚠️ Sem dados AI: ${player.id} — ${String(player.name ?? "")}`,
        );
        continue;
      }

      const overallData: OverallData = {
        sofascoreOriginal: aiPlayer.sofascoreOriginal,
        sofascoreVazia: aiPlayer.sofascoreVazia,
        cartinhaFifa: aiPlayer.cartinhaFifa,
        desempenhoTotal2026: aiPlayer.desempenhoTotal2026,
      };

      player.overallData = overallData;
      updated += 1;
    }
  }

  if (missing > 0) {
    throw new Error(
      `Existem ${missing} jogadores sem dados AI. Database não será salva parcialmente.`,
    );
  }

  await saveJson(MAIN_FILE, database);
  await saveJson(WEB_DATABASE_FILE, database);

  console.log("\n========================================");
  console.log("✅ DATABASE ATUALIZADA");
  console.log("========================================");
  console.log(`👥 Jogadores atualizados: ${updated}`);
  console.log(`📄 ${MAIN_FILE}`);
  console.log(`📄 ${WEB_DATABASE_FILE}`);
}

main().catch((error) => {
  console.error("\n💥 Erro fatal:");
  console.error(error);
  process.exitCode = 1;
});

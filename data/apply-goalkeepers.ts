import fs from "node:fs/promises";
import path from "node:path";

type Goalkeeper = {
  id: number;
  nome: string;
  slug: string | null;
  posicao: string;
  sofascoreVazia: Record<string, number>;
  cartinhaFifa: Record<string, number>;
  desempenhoTotal2026: number;
};

type AiPlayer = {
  id: number;
  nome: string;
  posicao: string | null;
  sofascoreOriginal: Record<string, number | null>;
  sofascoreVazia: Record<string, number>;
  cartinhaFifa: Record<string, number>;
  desempenhoTotal2026: number;
  [key: string]: unknown;
};

type AiTeam = {
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
  name: string;
  slug: string;
  players: MainPlayer[];
  [key: string]: unknown;
};

type MainDatabase = {
  teams: MainTeam[];
  [key: string]: unknown;
};

const GOALKEEPERS_FILE = path.resolve(process.cwd(), "golkeapers.json");
const AI_DIR = path.resolve(process.cwd(), "ai-overall");
const MAIN_FILE = path.resolve(process.cwd(), "brasileirao-2026.json");
const WEB_DATABASE_FILE = path.resolve(
  process.cwd(),
  "../web/database/game-database.json",
);

async function loadJson<T>(file: string): Promise<T> {
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as T;
}

async function saveJson(file: string, data: unknown) {
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

function isGoalkeeper(position: string | null | undefined) {
  const normalized = (position ?? "").toUpperCase();
  return normalized === "G" || normalized === "GK" || normalized === "GL";
}

async function main() {
  console.log("========================================");
  console.log("🧤 APLICANDO DADOS DOS GOLEIROS");
  console.log("========================================");

  const goalkeepers = await loadJson<Goalkeeper[]>(GOALKEEPERS_FILE);
  const database = await loadJson<MainDatabase>(MAIN_FILE);

  const goalkeeperById = new Map<number, Goalkeeper>();

  for (const goalkeeper of goalkeepers) {
    if (goalkeeperById.has(goalkeeper.id)) {
      throw new Error(`ID duplicado em golkeapers.json: ${goalkeeper.id}`);
    }

    goalkeeperById.set(goalkeeper.id, goalkeeper);
  }

  const aiFiles = (await fs.readdir(AI_DIR))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const aiPlayers = new Map<number, { player: AiPlayer; file: string }>();

  for (const file of aiFiles) {
    const fullPath = path.join(AI_DIR, file);
    const team = await loadJson<AiTeam>(fullPath);

    for (const player of team.jogadores) {
      if (aiPlayers.has(player.id)) {
        throw new Error(`ID duplicado em ai-overall: ${player.id}`);
      }

      aiPlayers.set(player.id, { player, file });
    }
  }

  let appliedToAi = 0;
  let appliedToDatabase = 0;
  let missingInAi = 0;
  let missingInDatabase = 0;
  const changedFiles = new Set<string>();

  for (const goalkeeper of goalkeepers) {
    const aiEntry = aiPlayers.get(goalkeeper.id);

    if (!aiEntry) {
      missingInAi += 1;
      console.warn(
        `⚠️ Goleiro não encontrado em ai-overall: ${goalkeeper.id} — ${goalkeeper.nome}`,
      );
      continue;
    }

    if (!isGoalkeeper(aiEntry.player.posicao)) {
      throw new Error(
        `ID ${goalkeeper.id} (${goalkeeper.nome}) existe em ai-overall, mas a posição é ${aiEntry.player.posicao}`,
      );
    }

    // Migra somente os dados AI que foram preenchidos em golkeapers.json.
    // Não sobrescreve sofascoreOriginal, nome, posição, idade ou valor de mercado.
    aiEntry.player.sofascoreVazia = goalkeeper.sofascoreVazia;
    aiEntry.player.cartinhaFifa = goalkeeper.cartinhaFifa;
    aiEntry.player.desempenhoTotal2026 = goalkeeper.desempenhoTotal2026;

    changedFiles.add(aiEntry.file);
    appliedToAi += 1;
  }

  // Salva os arquivos de time somente depois que todas as validações acima passaram.
  for (const file of changedFiles) {
    const fullPath = path.join(AI_DIR, file);
    const team = await loadJson<AiTeam>(fullPath);

    for (const player of team.jogadores) {
      const goalkeeper = goalkeeperById.get(player.id);
      if (!goalkeeper) continue;

      player.sofascoreVazia = goalkeeper.sofascoreVazia;
      player.cartinhaFifa = goalkeeper.cartinhaFifa;
      player.desempenhoTotal2026 = goalkeeper.desempenhoTotal2026;
    }

    await saveJson(fullPath, team);
  }

  // Também aplica diretamente na database principal e na cópia usada pelo web.
  // Assim não dependemos de uma segunda execução para refletir os goleiros.
  for (const team of database.teams) {
    for (const player of team.players) {
      const goalkeeper = goalkeeperById.get(player.id);
      if (!goalkeeper) continue;

      if (!isGoalkeeper(String(player.position ?? ""))) {
        throw new Error(
          `ID ${player.id} (${String(player.name ?? "")}) está em golkeapers.json, mas não é goleiro na database principal.`,
        );
      }

      player.overallData = {
        ...(typeof player.overallData === "object" && player.overallData !== null
          ? player.overallData
          : {}),
        sofascoreVazia: goalkeeper.sofascoreVazia,
        cartinhaFifa: goalkeeper.cartinhaFifa,
        desempenhoTotal2026: goalkeeper.desempenhoTotal2026,
      };

      appliedToDatabase += 1;
    }
  }

  for (const goalkeeper of goalkeepers) {
    const existsInDatabase = database.teams.some((team) =>
      team.players.some((player) => player.id === goalkeeper.id),
    );

    if (!existsInDatabase) {
      missingInDatabase += 1;
      console.warn(
        `⚠️ Goleiro não encontrado na database principal: ${goalkeeper.id} — ${goalkeeper.nome}`,
      );
    }
  }

  if (missingInAi > 0 || missingInDatabase > 0) {
    throw new Error(
      `Migração incompleta: ${missingInAi} ausentes em ai-overall, ${missingInDatabase} ausentes na database principal. Nenhuma database principal foi salva.`,
    );
  }

  await saveJson(MAIN_FILE, database);
  await saveJson(WEB_DATABASE_FILE, database);

  console.log("\n========================================");
  console.log("✅ GOLEIROS APLICADOS");
  console.log("========================================");
  console.log(`🧤 Goleiros no arquivo fonte: ${goalkeepers.length}`);
  console.log(`📁 Arquivos ai-overall alterados: ${changedFiles.size}`);
  console.log(`🧩 Jogadores atualizados no ai-overall: ${appliedToAi}`);
  console.log(`🗄️ Jogadores atualizados na database: ${appliedToDatabase}`);
  console.log(`📄 ${MAIN_FILE}`);
  console.log(`📄 ${WEB_DATABASE_FILE}`);
}

main().catch((error) => {
  console.error("\n💥 Erro fatal:");
  console.error(error);
  process.exitCode = 1;
});

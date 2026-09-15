import fs from "node:fs/promises";
import path from "node:path";

const INPUT_FILE = path.join(
  process.cwd(),
  "brasileirao-2026.json"
);

const OUTPUT_FILE = path.join(
  process.cwd(),
  "players-erros.json"
);

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


// ============================================================
// CARREGAR JSON
// ============================================================

async function loadJson(): Promise<BrasileiraoData> {

  const content = await fs.readFile(
    INPUT_FILE,
    "utf-8"
  );

  return JSON.parse(content);
}


// ============================================================
// VERIFICAR ATTRIBUTES
// ============================================================

function hasAttributes(player: Player): boolean {

  return (
    player.averageAttributeOverviews !== undefined &&
    player.averageAttributeOverviews !== null
  );
}


// ============================================================
// MAIN
// ============================================================

async function main(): Promise<void> {

  console.log("========================================");
  console.log("🔎 PLAYERS-ERROS");
  console.log("========================================");

  console.log(`\n📁 Entrada: ${INPUT_FILE} `);

  const data = await loadJson();

  const errors: PlayerError[] = [];

  let totalPlayers = 0;
  let totalOk = 0;


  // ==========================================================
  // TIMES
  // ==========================================================

  for (const team of data.teams) {

    console.log(`\n⚽ ${team.name} `);

    let teamErrors = 0;

    // ========================================================
    // PLAYERS
    // ========================================================

    for (const player of team.players) {

      totalPlayers++;

      if (hasAttributes(player)) {

        totalOk++;

        continue;
      }

      teamErrors++;

      errors.push({
        teamId: team.id,
        teamName: team.name,
        teamSlug: team.slug,

        playerId: player.id,
        playerName: player.name,
        playerSlug: player.slug,

        playerUrl:
          `https://www.sofascore.com/pt/football/player/${player.slug}/${player.id}`,

        attributeUrl:
          `https://www.sofascore.com/api/v1/player/${player.id}/attribute-overviews`
      });

      console.log(
        `   ❌ ${player.name} (${player.id})`
      );
    }

    console.log(
      `   Pendentes: ${teamErrors}`
    );
  }


  // ==========================================================
  // SALVAR
  // ==========================================================

  await fs.writeFile(
    OUTPUT_FILE,
    JSON.stringify(errors, null, 2),
    "utf-8"
  );


  // ==========================================================
  // RESULTADO
  // ==========================================================

  console.log("\n========================================");
  console.log("📊 RESULTADO");
  console.log("========================================");

  console.log(
    `👥 Total de players: ${totalPlayers}`
  );

  console.log(
    `✅ OK: ${totalOk}`
  );

  console.log(
    `❌ Pendentes: ${errors.length}`
  );

  console.log(
    `\n💾 Arquivo gerado: ${OUTPUT_FILE}`
  );
}


main().catch(error => {

  console.error("\n💥 ERRO:");
  console.error(error);

  process.exit(1);
});

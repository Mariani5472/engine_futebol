import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { scrapeRosters } from "./scraper.js";
import { SERIE_A_2026_CLUBS } from "./teams.js";
import { validateDataset } from "./validate.js";

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputFile = resolve(packageDirectory, "data", "brasileirao-2026.json");
const dataset = await scrapeRosters(SERIE_A_2026_CLUBS);
const errors = validateDataset(dataset);

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
  console.log(`Dataset salvo em ${outputFile}: ${dataset.teams.length} clubes, ${dataset.failures.length} falhas.`);
}

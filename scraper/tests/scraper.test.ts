import assert from "node:assert/strict";
import { mapRoster, normalizePosition } from "../src/mapper.js";
import { validateDataset } from "../src/validate.js";

assert.equal(normalizePosition("Goleiro"), "GK");
assert.equal(normalizePosition("Defender"), "DEF");
assert.equal(normalizePosition("Meio-campista"), "MID");
assert.equal(normalizePosition("Atacante"), "FWD");
assert.equal(normalizePosition("Comissão técnica"), "UNKNOWN");

const roster = mapRoster({
  team: { id: "2029", displayName: "Palmeiras", abbreviation: "PAL", logo: "https://example.test/logo.png" },
  athletes: [{ id: "1", displayName: "Jogador", shortName: "Joga", jersey: "10", citizenship: "Brasil", age: 25, height: 72, weight: 176, position: { displayName: "Meio-campista", abbreviation: "M" }, headshot: { href: "https://example.test/player.png" } }]
}, { id: "2029", name: "Palmeiras" });
assert.equal(roster.athletes[0]?.position, "MID");
assert.equal(roster.athletes[0]?.heightCm, 183);
assert.equal(roster.athletes[0]?.weightKg, 80);

const duplicateErrors = validateDataset({ source: "ESPN", competition: "Brasileirão Série A", season: 2026, generatedAt: "2026-01-01T00:00:00.000Z", failures: Array.from({ length: 18 }, (_, index) => ({ clubId: `f${index}`, clubName: "Falhou", error: "x" })), teams: [roster, { ...roster, athletes: [...roster.athletes, ...roster.athletes] }] });
assert.ok(duplicateErrors.some((error) => error.includes("duplicado")));
console.log("scraper tests passed");

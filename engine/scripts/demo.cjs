const { simulateMatch } = require("../dist/index.js");

function makeTeam(id, name, quality) {
  const positions = ["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD", "DEF", "MID", "FWD"];
  return {
    id,
    name,
    formation: "4-3-3",
    players: positions.map((position, index) => ({
      id: `${id}-${index + 1}`,
      name: `${name} ${index + 1}`,
      position,
      attributes: { mental: quality, physical: quality, technical: quality },
    })),
  };
}

const result = simulateMatch({
  homeTeam: makeTeam("aurora", "Aurora FC", 13),
  awayTeam: makeTeam("racing", "Racing Sul", 12),
  seed: 42,
});

console.log("Match Engine V2");
console.log(`Final score: ${result.score.home} - ${result.score.away}`);
console.log("Statistics:", JSON.stringify(result.statistics));
console.log("Events:");
for (const event of result.events) console.log(JSON.stringify(event));

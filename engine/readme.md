# Match Engine V2

A small, deterministic football match simulator for web applications. It models ninety abstract minutes: each minute may produce a shot, a yellow card, or a substitution. It is deliberately not a physical football simulation.

It does **not** contain ball physics, player movement, collisions, pathfinding, tactical AI, a frame loop, React, HTTP, a database, or browser APIs. The UI receives finished data and decides how to animate or render it.

## Install and run

From this repository root:

```bash
npm install
npm test
npm run build
```

Or start the local manager application:

```bash
docker compose up
```

It starts the Vite application at [http://localhost:5173](http://localhost:5173). The manager UI consumes the engine in the browser; the engine itself remains independent of HTTP and React.

The engine package can also be consumed as `@match-engine/core`.

## Simulate a match

```ts
import { simulateMatch, type Team } from "@match-engine/core";

const homeTeam: Team = {
  id: "aurora",
  name: "Aurora FC",
  formation: "4-3-3",
  players: [/* 11 starters, then optional substitutes */],
};

const awayTeam: Team = { /* same shape */ };

const result = simulateMatch({ homeTeam, awayTeam, seed: 123456 });

console.log(result.score);
for (const event of result.events) console.log(event);
```

Each player has an `id`, `name`, `position` (`GK`, `DEF`, `MID`, or `FWD`) and integer `mental`, `physical`, and `technical` attributes from 1 to 20. A team supplies at least eleven players; the first eleven start and later players are substitutes.

The same teams and seed always return the identical result. Use a different seed to create another reproducible match. `homeAdvantage` defaults to `1.05` and can be overridden in the input.

## Result data

`result.events` contains only `MATCH_STARTED`, `SHOT`, `YELLOW_CARD`, `SUBSTITUTION`, `HALF_TIME`, and `MATCH_FINISHED`. `result.statistics` includes possession, shots, shots on target, goals, yellow cards, and corners. `result.finalState` has the final player statuses, minutes, goals, shots, cards, and ratings.

Pass `debug: true` to receive one compact diagnostic entry per shot, including its attack power, defense power, and outcome. It is returned as data; the engine never logs to the console.

## React integration

Call `simulateMatch` outside the render body (for example, in an event handler, loader, or memo keyed by the input) and render `result.events` as a timeline. The engine has no React dependency, so the same input also works in Node, tests, workers, and the browser.

## Distribution check

Run `npm run distribution --workspace @match-engine/core` to simulate 10,000 matches and print win, draw, goal, and shot averages. This is a calibration aid, not a fragile score assertion.

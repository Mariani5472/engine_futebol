import type { MatchSnapshot, PlayerSnapshot } from "./types";

const formation = [
  [7, 50], [22, 16], [22, 38], [22, 62], [22, 84], [42, 24],
  [42, 50], [42, 76], [62, 22], [65, 50], [62, 78],
] as const;

export class DemoMatchFeed {
  private time = 0;

  public reset(): MatchSnapshot {
    this.time = 0;
    return this.snapshot();
  }

  public update(deltaSeconds: number): MatchSnapshot {
    this.time += deltaSeconds;
    return this.snapshot();
  }

  private snapshot(): MatchSnapshot {
    const players: PlayerSnapshot[] = [];
    formation.forEach(([x, y], index) => {
      const sway = Math.sin(this.time * 0.65 + index * 0.7);
      players.push({ id: `home-${index}`, number: index + 1, team: "HOME", x: x + sway * 3, y: y + Math.cos(this.time + index) * 2 });
      players.push({ id: `away-${index}`, number: index + 1, team: "AWAY", x: 100 - x - sway * 3, y: 100 - y + Math.sin(this.time + index) * 2 });
    });
    const phase = this.time * 0.34;
    return {
      time: this.time,
      players,
      ball: { x: 50 + Math.sin(phase) * 34, y: 50 + Math.sin(phase * 1.7) * 28 },
    };
  }
}

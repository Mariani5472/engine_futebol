import type { MatchSnapshot, PlayerSnapshot, Point } from "./types";

// Home attacks right and starts entirely at x < 50. Away is mirrored.
const homeFormation = [
  [6, 50],
  [18, 14], [18, 37], [18, 63], [18, 86],
  [34, 22], [38, 46], [34, 78],
  [44, 22], [48.2, 50], [44, 78],
] as const;

const KICKOFF_BALL: Point = { x: 50, y: 50 };
const RECEIVER: Point = { x: 38, y: 46 };

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * Math.max(0, Math.min(1, alpha));
}

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
    const phase = this.phase();
    const players: PlayerSnapshot[] = [];

    homeFormation.forEach(([baseX, baseY], index) => {
      const openPlay = phase === "OPEN_PLAY";
      const swayX = openPlay ? Math.sin(this.time * 0.75 + index * 0.7) * 3.5 : 0;
      const swayY = openPlay ? Math.cos(this.time * 0.9 + index) * 2.2 : 0;
      const kickoffNudge = index === 9 && phase === "KICKOFF_PASS"
        ? Math.min(1.1, (this.time - 0.8) * 2)
        : 0;

      players.push({
        id: `home-${index}`, number: index + 1, team: "HOME",
        x: baseX + swayX + kickoffNudge, y: baseY + swayY,
      });
      players.push({
        id: `away-${index}`, number: index + 1, team: "AWAY",
        x: 100 - baseX - swayX, y: 100 - baseY - swayY,
      });
    });

    return { time: this.time, phase, players, ball: this.ballPosition(phase) };
  }

  private phase(): MatchSnapshot["phase"] {
    if (this.time < 0.8) return "READY";
    if (this.time < 1.4) return "KICKOFF_PASS";
    if (this.time < 2) return "RECEIVED";
    return "OPEN_PLAY";
  }

  private ballPosition(phase: MatchSnapshot["phase"]): Point {
    if (phase === "READY") return KICKOFF_BALL;
    if (phase === "KICKOFF_PASS") {
      const progress = (this.time - 0.8) / 0.6;
      return {
        x: lerp(KICKOFF_BALL.x, RECEIVER.x, progress),
        y: lerp(KICKOFF_BALL.y, RECEIVER.y, progress),
      };
    }
    if (phase === "RECEIVED") return RECEIVER;
    const cycle = (this.time - 2) % 4;
    const other = { x: 72, y: 27 };
    const forward = cycle < 2;
    const progress = (forward ? cycle : cycle - 2) / 2;
    const from = forward ? RECEIVER : other;
    const to = forward ? other : RECEIVER;
    return { x: lerp(from.x, to.x, progress), y: lerp(from.y, to.y, progress) };
  }
}

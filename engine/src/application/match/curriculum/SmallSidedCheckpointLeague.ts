import type { CurriculumCheckpoint } from "./CurriculumPlan";

export const SMALL_SIDED_LEAGUE_VERSION = 1 as const;
export type SmallSidedDivision = "FIVE_V_FIVE" | "SEVEN_V_SEVEN";

export interface SmallSidedLeagueEntry {
  readonly checkpoint: CurriculumCheckpoint;
  readonly division: SmallSidedDivision;
  readonly rating: number;
  readonly games: number;
  readonly wins: number;
  readonly draws: number;
  readonly losses: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

export interface SmallSidedFixture {
  readonly division: SmallSidedDivision;
  readonly homeCheckpointId: string;
  readonly awayCheckpointId: string;
  readonly seed: number;
}

/** Deterministic first checkpoint league for reduced-football promotion. */
export class SmallSidedCheckpointLeague {
  private readonly entries = new Map<string, SmallSidedLeagueEntry>();

  public register(checkpoint: CurriculumCheckpoint, division: SmallSidedDivision, rating = 1_000): void {
    if (checkpoint.kind !== "COLLECTIVE") throw new Error("small-sided league accepts COLLECTIVE checkpoints only");
    if (checkpoint.stage !== division) throw new Error(`checkpoint stage ${checkpoint.stage} does not match ${division}`);
    if (this.entries.has(checkpoint.id)) throw new Error(`checkpoint ${checkpoint.id} is already registered`);
    this.entries.set(checkpoint.id, Object.freeze({
      checkpoint: Object.freeze({ ...checkpoint }), division, rating,
      games: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0,
    }));
  }

  public standings(division: SmallSidedDivision): readonly SmallSidedLeagueEntry[] {
    return Object.freeze([...this.entries.values()]
      .filter(entry => entry.division === division)
      .sort((left, right) => right.rating - left.rating
        || (right.goalsFor - right.goalsAgainst) - (left.goalsFor - left.goalsAgainst)
        || left.checkpoint.id.localeCompare(right.checkpoint.id)));
  }

  /** Stable double round-robin fixtures; a caller may shard them freely. */
  public fixtures(division: SmallSidedDivision, seedStart: number): readonly SmallSidedFixture[] {
    if (!Number.isInteger(seedStart)) throw new Error("seedStart must be an integer");
    const ids = this.standings(division).map(entry => entry.checkpoint.id).sort();
    const fixtures: SmallSidedFixture[] = [];
    let seed = seedStart;
    for (let home = 0; home < ids.length; home++) {
      for (let away = home + 1; away < ids.length; away++) {
        fixtures.push(Object.freeze({ division, homeCheckpointId: ids[home], awayCheckpointId: ids[away], seed: seed++ }));
        fixtures.push(Object.freeze({ division, homeCheckpointId: ids[away], awayCheckpointId: ids[home], seed: seed++ }));
      }
    }
    return Object.freeze(fixtures);
  }

  public record(fixture: SmallSidedFixture, homeGoals: number, awayGoals: number, kFactor = 24): void {
    const home = this.require(fixture.homeCheckpointId, fixture.division);
    const away = this.require(fixture.awayCheckpointId, fixture.division);
    if (![homeGoals, awayGoals].every(value => Number.isInteger(value) && value >= 0)) throw new Error("goals must be non-negative integers");
    const homeScore: 0 | .5 | 1 = homeGoals > awayGoals ? 1 : homeGoals === awayGoals ? .5 : 0;
    const expectedHome = 1 / (1 + 10 ** ((away.rating - home.rating) / 400));
    this.entries.set(home.checkpoint.id, this.updated(home, homeGoals, awayGoals, homeScore, kFactor * (homeScore - expectedHome)));
    this.entries.set(away.checkpoint.id, this.updated(away, awayGoals, homeGoals, (1 - homeScore) as 0 | .5 | 1, -kFactor * (homeScore - expectedHome)));
  }

  private updated(entry: SmallSidedLeagueEntry, goalsFor: number, goalsAgainst: number, score: 0 | .5 | 1, ratingDelta: number): SmallSidedLeagueEntry {
    return Object.freeze({
      ...entry, rating: entry.rating + ratingDelta, games: entry.games + 1,
      wins: entry.wins + (score === 1 ? 1 : 0), draws: entry.draws + (score === .5 ? 1 : 0),
      losses: entry.losses + (score === 0 ? 1 : 0),
      goalsFor: entry.goalsFor + goalsFor, goalsAgainst: entry.goalsAgainst + goalsAgainst,
    });
  }

  private require(id: string, division: SmallSidedDivision): SmallSidedLeagueEntry {
    const entry = this.entries.get(id);
    if (!entry || entry.division !== division) throw new Error(`unknown ${division} checkpoint ${id}`);
    return entry;
  }
}

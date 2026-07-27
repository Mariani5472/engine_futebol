import { CardEvent, CardType, MatchPeriod, Milliseconds, PlayerId, TeamId } from "../../../domain";
import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { Random } from "../../../core/random/Random";
import { FoulRecord } from "./FoulRecord";

export interface FoulOutcome {
  readonly isFoul: boolean;
  readonly isCard: boolean;
  readonly cardType?: CardType;
  readonly events: CardEvent[];
}

/**
 * Discipline model calibrated toward Brasileirão-like rates:
 *   ~25–30 fouls / game (both teams)
 *   ~4–5 yellows / game
 *   ~0.2 reds / game
 *
 * Previous model treated ~half of all tackles as fouls and converted
 * yellows to reds so fast that matches averaged ~21 red cards.
 */

/** Base chance a contested tackle becomes a foul (before danger / strictness). */
const BASE_FOUL_CHANCE = 0.18;

/** Minimum danger before foul is even considered. */
const FOUL_DANGER_FLOOR = 0.35;

/** Danger needed before a *direct* red is possible (rare). */
const DIRECT_RED_DANGER = 0.92;

/** Base P(direct red | foul & extreme danger). */
const DIRECT_RED_CHANCE = 0.04;

/** Base P(yellow | foul) before player traits. Target ~15–20% of fouls. */
const BASE_YELLOW_CHANCE = 0.12;

export class RefereeSystem {
  private readonly records: Map<string, FoulRecord> = new Map();

  constructor(private readonly random: Random) {}

  /**
   * Evaluates a tackle for foul / card.
   *
   * @param tackleSucceeded  clean win on the ball → much lower foul chance
   * @param tackleDanger     0–1 contact severity from TackleAction
   */
  public evaluateTackle(
    tackler: PlayerMatchState,
    tacklerTeam: TeamMatchState,
    _victim: PlayerMatchState,
    _victimTeam: TeamMatchState,
    tackleDanger: number,
    match: MatchState,
    period: MatchPeriod,
    matchSecond: number,
    tackleSucceeded: boolean = false,
  ): FoulOutcome {
    // Already sent off — should not be tackling, but ignore further cards.
    if (this.isPlayerSentOff(tackler.player.id)) {
      return { isFoul: false, isCard: false, events: [] };
    }

    const strictness = this.resolveStrictness(match); // 0–1
    const danger = Math.max(0, Math.min(1, tackleDanger));

    // Successful, controlled challenges are rarely fouls.
    if (tackleSucceeded && danger < 0.55) {
      return { isFoul: false, isCard: false, events: [] };
    }

    if (danger < FOUL_DANGER_FLOOR) {
      return { isFoul: false, isCard: false, events: [] };
    }

    // P(foul) rises with danger and referee strictness; falls on clean wins.
    const successFactor = tackleSucceeded ? 0.25 : 1.0;
    const foulChance = Math.min(
      0.55,
      BASE_FOUL_CHANCE
        * successFactor
        * (0.6 + danger * 1.2)
        * (0.75 + strictness * 0.5),
    );

    if (this.random.nextFloat(0, 1) >= foulChance) {
      return { isFoul: false, isCard: false, events: [] };
    }

    // ── Foul awarded ───────────────────────────────────────────────
    const events: CardEvent[] = [];

    // Direct red: only on extreme danger + unlucky roll.
    if (danger >= DIRECT_RED_DANGER && this.random.nextFloat(0, 1) < DIRECT_RED_CHANCE) {
      events.push(
        ...this.issueCard(
          tackler,
          tacklerTeam,
          "RED",
          "Violent conduct",
          period,
          matchSecond,
        ),
      );
      return { isFoul: true, isCard: true, cardType: "RED", events };
    }

    // Yellow: minority of fouls.
    const aggression = (tackler.player.attributes.mental.aggression ?? 10) / 20;
    const dirtiness = (tackler.player.attributes.hidden.dirtiness ?? 5) / 20;

    const yellowChance = Math.min(
      0.35,
      BASE_YELLOW_CHANCE
        * (0.7 + danger * 0.8)
        * (0.8 + aggression * 0.4 + dirtiness * 0.3)
        * (0.85 + strictness * 0.3),
    );

    if (this.random.nextFloat(0, 1) < yellowChance) {
      events.push(
        ...this.issueCard(
          tackler,
          tacklerTeam,
          "YELLOW",
          "Reckless tackle",
          period,
          matchSecond,
        ),
      );
      const issuedRed = events.some((e) => e.cardType === "RED");
      return {
        isFoul: true,
        isCard: true,
        cardType: issuedRed ? "RED" : "YELLOW",
        events,
      };
    }

    // Soft foul — free kick / stoppage only, no card event.
    return { isFoul: true, isCard: false, events: [] };
  }

  private resolveStrictness(match: MatchState): number {
    // MatchState does not yet carry the Referee aggregate on every path;
    // default mid-strictness keeps rates stable until wired.
    void match;
    return 0.5;
  }

  private issueCard(
    player: PlayerMatchState,
    team: TeamMatchState,
    cardType: CardType,
    reason: string,
    period: MatchPeriod,
    matchSecond: number,
  ): CardEvent[] {
    let record = this.records.get(player.player.id);
    if (!record) {
      record = {
        playerId: player.player.id,
        teamId: team.team.id,
        yellowCards: 0,
        redCard: false,
      };
      this.records.set(player.player.id, record);
    }

    // Already has a red — do not stack more cards.
    if (record.redCard) {
      return [];
    }

    const events: CardEvent[] = [];

    if (cardType === "YELLOW") {
      record.yellowCards++;

      events.push({
        id: `card-y-${player.player.id}-${matchSecond.toFixed(1)}-${record.yellowCards}`,
        type: "CARD",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId: team.team.id as TeamId,
        playerId: player.player.id as PlayerId,
        cardType: "YELLOW",
        reason,
      });

      // Second yellow → red (still realistic if yellow rate is low).
      if (record.yellowCards >= 2) {
        record.redCard = true;
        events.push({
          id: `card-r2y-${player.player.id}-${matchSecond.toFixed(1)}`,
          type: "CARD",
          timestamp: (matchSecond * 1000) as Milliseconds,
          period,
          teamId: team.team.id as TeamId,
          playerId: player.player.id as PlayerId,
          cardType: "RED",
          reason: "Second yellow card",
        });
      }
    } else {
      record.redCard = true;
      events.push({
        id: `card-r-${player.player.id}-${matchSecond.toFixed(1)}`,
        type: "CARD",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId: team.team.id as TeamId,
        playerId: player.player.id as PlayerId,
        cardType: "RED",
        reason,
      });
    }

    return events;
  }

  public isPlayerSentOff(playerId: string): boolean {
    return this.records.get(playerId)?.redCard ?? false;
  }

  public getYellowCards(playerId: string): number {
    return this.records.get(playerId)?.yellowCards ?? 0;
  }

  public getAllRecords(): readonly FoulRecord[] {
    return [...this.records.values()];
  }

  /** Reset between matches if the same RefereeSystem instance is reused. */
  public reset(): void {
    this.records.clear();
  }
}

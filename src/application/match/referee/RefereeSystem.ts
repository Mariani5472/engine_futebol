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

const BASE_FOUL_CHANCE = 0.045;
const FOUL_DANGER_FLOOR = 0.34;
const DIRECT_RED_DANGER = 0.97;
const DIRECT_RED_CHANCE = 0.006;
const BASE_YELLOW_CHANCE = 0.50;
const MAX_YELLOW_CHANCE = 0.45;
const REPEAT_BOOKING_FACTOR = 0.013;

export class RefereeSystem {
  private readonly records: Map<string, FoulRecord> = new Map();

  constructor(private readonly random: Random) {}

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
    if (this.isPlayerSentOff(tackler.player.id)) {
      return { isFoul: false, isCard: false, events: [] };
    }

    const strictness = this.resolveStrictness(match);
    const danger = Math.max(0, Math.min(1, tackleDanger));

    if (tackleSucceeded && danger < 0.50) {
      return { isFoul: false, isCard: false, events: [] };
    }

    if (danger < FOUL_DANGER_FLOOR) {
      return { isFoul: false, isCard: false, events: [] };
    }

    const successFactor = tackleSucceeded ? 0.28 : 1.0;
    const foulChance = Math.min(
      0.58,
      BASE_FOUL_CHANCE
        * successFactor
        * (0.55 + danger * 1.15)
        * (0.80 + strictness * 0.45),
    );

    if (this.random.nextFloat(0, 1) >= foulChance) {
      return { isFoul: false, isCard: false, events: [] };
    }

    const events: CardEvent[] = [];

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

    const aggression = (tackler.player.attributes.mental.aggression ?? 10) / 20;
    const dirtiness = (tackler.player.attributes.hidden.dirtiness ?? 5) / 20;
    const alreadyBooked =
      (this.records.get(tackler.player.id)?.yellowCards ?? 0) > 0;

    const yellowChance = Math.min(
      MAX_YELLOW_CHANCE,
      BASE_YELLOW_CHANCE
        * (alreadyBooked ? REPEAT_BOOKING_FACTOR : 1)
        * (0.65 + danger * 0.75)
        * (0.85 + aggression * 0.35 + dirtiness * 0.25)
        * (0.85 + strictness * 0.25),
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

    return { isFoul: true, isCard: false, events: [] };
  }

  private resolveStrictness(match: MatchState): number {
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

  public reset(): void {
    this.records.clear();
  }
}

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

/** Above this tackle "danger" score, a foul is likely. */
const FOUL_THRESHOLD = 0.55;
/** Above this score, a direct red card is possible (violent conduct). */
const RED_CARD_DIRECT_THRESHOLD = 0.85;

/**
 * Detects fouls on tackle actions and administers discipline.
 * Also tracks yellow/red cards across the match.
 */
export class RefereeSystem {

  private readonly records: Map<string, FoulRecord> = new Map();

  constructor(private readonly random: Random) {}

  /**
   * Evaluates a tackle attempt for foul potential.
   * Called by TackleAction after a failed or dangerous tackle.
   */
  public evaluateTackle(
    tackler: PlayerMatchState,
    tacklerTeam: TeamMatchState,
    victim: PlayerMatchState,
    _victimTeam: TeamMatchState,
    tackleDanger: number, // 0-1: how dangerous the tackle was
    match: MatchState,
    period: MatchPeriod,
    matchSecond: number
  ): FoulOutcome {

    const referee = match.pitch; // we don't have referee object here — use match-level data
    void referee; // silence unused warning

    const strictness = 50 / 100; // default; real value wired in engine
    const dangerScore = tackleDanger * (0.7 + strictness * 0.6);

    if (dangerScore < FOUL_THRESHOLD) {
      return { isFoul: false, isCard: false, events: [] };
    }

    // Foul awarded.
    const isViolentConduct = dangerScore >= RED_CARD_DIRECT_THRESHOLD;
    const events: CardEvent[] = [];

    if (isViolentConduct) {
      // Direct red.
      events.push(...this.issueCard(
        tackler, tacklerTeam, "RED",
        "Violent conduct",
        period, matchSecond
      ));
      return { isFoul: true, isCard: true, cardType: "RED", events };
    }

    // Check for card (probability based on aggression + dirtiness).
    const aggression = tackler.player.attributes.mental.aggression / 20;
    const dirtiness = tackler.player.attributes.hidden.dirtiness / 20;
    const cardProbability = (aggression * 0.4 + dirtiness * 0.3 + dangerScore * 0.3);

    if (this.random.nextFloat(0, 1) < cardProbability * 0.6) {
      events.push(...this.issueCard(
        tackler, tacklerTeam, "YELLOW",
        "Reckless tackle",
        period, matchSecond
      ));
      return { isFoul: true, isCard: true, cardType: "YELLOW", events };
    }

    return { isFoul: true, isCard: false, events: [] };

  }

  private issueCard(
    player: PlayerMatchState,
    team: TeamMatchState,
    cardType: CardType,
    reason: string,
    period: MatchPeriod,
    matchSecond: number
  ): CardEvent[] {

    let record = this.records.get(player.player.id);
    if (!record) {
      record = {
        playerId: player.player.id,
        teamId: team.team.id,
        yellowCards: 0,
        redCard: false
      };
      this.records.set(player.player.id, record);
    }

    const events: CardEvent[] = [];

    if (cardType === "YELLOW") {
      record.yellowCards++;

      events.push({
        id: `card-${player.player.id}-${Date.now()}`,
        type: "CARD",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId: team.team.id as TeamId,
        playerId: player.player.id as PlayerId,
        cardType: "YELLOW",
        reason
      });

      // Second yellow → red.
      if (record.yellowCards >= 2) {
        record.redCard = true;
        events.push({
          id: `card-${player.player.id}-red-${Date.now()}`,
          type: "CARD",
          timestamp: (matchSecond * 1000) as Milliseconds,
          period,
          teamId: team.team.id as TeamId,
          playerId: player.player.id as PlayerId,
          cardType: "RED",
          reason: "Second yellow card"
        });
      }

    } else {
      record.redCard = true;
      events.push({
        id: `card-${player.player.id}-red-${Date.now()}`,
        type: "CARD",
        timestamp: (matchSecond * 1000) as Milliseconds,
        period,
        teamId: team.team.id as TeamId,
        playerId: player.player.id as PlayerId,
        cardType: "RED",
        reason
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

}

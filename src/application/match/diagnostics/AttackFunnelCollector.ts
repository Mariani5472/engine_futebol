import { MatchState } from "../../../core/movement/MatchState";
import { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { WorldAwareness } from "../awareness/WorldAwareness";
import { FieldThird } from "../../../domain";

export const SHOOTING_ZONE_DISTANCE = 20;

export interface AttackFunnelReport {
  readonly ticks: number;
  readonly possessionTicks: number;
  readonly attackingThirdPossessionTicks: number;
  readonly shootingZoneTicks: number;
  readonly opponentHalfPossessionTicks: number;

  readonly attackingThirdShareOfPossession: number;
  readonly shootingZoneShareOfPossession: number;
  readonly opponentHalfShareOfPossession: number;
  readonly ownershipRatio: number;

  readonly possessionDecisions: Readonly<Record<string, number>>;
  readonly possessionDecisionsInAttackingThird: Readonly<Record<string, number>>;
  readonly possessionDecisionsInShootingZone: Readonly<Record<string, number>>;

  readonly totalPossessionDecisions: number;
  readonly shotDecisions: number;
  readonly shotDecisionsInShootingZone: number;
  readonly passDecisions: number;
  readonly holdDecisions: number;
  readonly dribbleDecisions: number;

  readonly avgGoalDistanceWhenInPossession: number;
  readonly minGoalDistanceObserved: number;

  readonly avgSelectedPassForwardProgress: number;
  readonly progressivePassCount: number;
  readonly lateralPassCount: number;
  readonly backwardPassCount: number;
  readonly supportAheadShareOfPossession: number;

  readonly avgPassRealForwardGain: number;
  readonly passEffectiveProgressiveRate: number;
  readonly avgLaneVsRealAbsError: number;
  readonly completedPassSamples: number;
  readonly avgTicksUntilOwnHalfReturn: number;
  readonly ownHalfReturnSamples: number;

  /** Throughput: tryStart(PASS) calls. */
  readonly passTryStarts: number;
  /** Throughput: PASS reached EXECUTING. */
  readonly passReachedExecuting: number;
  /** Throughput: resolveExecuting success. */
  readonly passResolvedSuccess: number;
  /** Throughput: resolveExecuting failure. */
  readonly passResolvedFailure: number;
  /** Ratio resolvedSuccess / tryStarts. */
  readonly passCompletionRatio: number;
  /** Ball-carrier ticks while isActionBusy. */
  readonly carrierBusyTicks: number;
  readonly carrierBusyShareOfPossession: number;
  readonly avgPassWindupSeconds: number;
  readonly avgPassRecoverySeconds: number;
}

export class AttackFunnelCollector {
  private ticks = 0;
  private possessionTicks = 0;
  private attackingThirdPossessionTicks = 0;
  private shootingZoneTicks = 0;
  private opponentHalfPossessionTicks = 0;
  private supportAheadTicks = 0;
  private carrierBusyTicks = 0;

  private goalDistanceSum = 0;
  private goalDistanceSamples = 0;
  private minGoalDistance = Number.POSITIVE_INFINITY;

  private passForwardSum = 0;
  private passForwardSamples = 0;
  private progressivePassCount = 0;
  private lateralPassCount = 0;
  private backwardPassCount = 0;

  private passRealGainSum = 0;
  private passRealGainSamples = 0;
  private passEffectiveProgressive = 0;
  private laneVsRealAbsErrorSum = 0;

  private passTryStarts = 0;
  private passReachedExecuting = 0;
  private passResolvedSuccess = 0;
  private passResolvedFailure = 0;
  private passWindupSum = 0;
  private passRecoverySum = 0;
  private passTimingSamples = 0;

  private opponentHalfStreak = 0;
  private ownHalfReturnSum = 0;
  private ownHalfReturnSamples = 0;
  private wasInOpponentHalf = false;

  private readonly possessionDecisions: Record<string, number> = {};
  private readonly possessionDecisionsInAttackingThird: Record<string, number> = {};
  private readonly possessionDecisionsInShootingZone: Record<string, number> = {};

  public sampleState(state: MatchState): void {
    this.ticks++;

    const owner = state.ball.owner;
    if (!owner) {
      this.wasInOpponentHalf = false;
      this.opponentHalfStreak = 0;
      return;
    }

    this.possessionTicks++;
    if (owner.isActionBusy()) this.carrierBusyTicks++;

    const isHome = state.home.players.includes(owner);
    const team = isHome ? state.home : state.away;
    const dir = team.attackingDirection;
    const pitchLength = state.pitch.length;

    const goalX = dir === 1 ? pitchLength : 0;
    const goalY = state.pitch.width / 2;
    const goalDistance = Math.hypot(
      owner.position.x - goalX,
      owner.position.y - goalY,
    );

    this.goalDistanceSum += goalDistance;
    this.goalDistanceSamples++;
    if (goalDistance < this.minGoalDistance) {
      this.minGoalDistance = goalDistance;
    }

    if (this.isAttackingThird(owner.position.x, dir, pitchLength)) {
      this.attackingThirdPossessionTicks++;
    }
    const inOppHalf = this.isOpponentHalf(owner.position.x, dir, pitchLength);
    if (inOppHalf) {
      this.opponentHalfPossessionTicks++;
      this.opponentHalfStreak++;
      this.wasInOpponentHalf = true;
    } else if (this.wasInOpponentHalf) {
      this.ownHalfReturnSum += this.opponentHalfStreak;
      this.ownHalfReturnSamples++;
      this.opponentHalfStreak = 0;
      this.wasInOpponentHalf = false;
    }

    if (goalDistance <= SHOOTING_ZONE_DISTANCE) {
      this.shootingZoneTicks++;
    }

    let supportAhead = false;
    for (const tm of team.players) {
      if (tm === owner) continue;
      const progress = (tm.position.x - owner.position.x) * dir;
      if (progress >= 5) {
        supportAhead = true;
        break;
      }
    }
    if (supportAhead) this.supportAheadTicks++;
  }

  public onPossessionDecision(
    decisionType: DecisionType,
    player: PlayerMatchState,
    world: WorldAwareness,
    decision?: Decision,
  ): void {
    if (!player.hasBall) return;

    const name = DecisionType[decisionType] ?? String(decisionType);
    this.bump(this.possessionDecisions, name);

    if (
      world.fieldThird === FieldThird.ATTACKING ||
      String(world.fieldThird) === "ATTACKING"
    ) {
      this.bump(this.possessionDecisionsInAttackingThird, name);
    }

    if (world.goalDistance <= SHOOTING_ZONE_DISTANCE) {
      this.bump(this.possessionDecisionsInShootingZone, name);
    }

    if (decisionType === DecisionType.PASS && decision?.targetId) {
      const lane = world.passingLanes.find((l) => l.targetId === decision.targetId);
      const fp = lane?.forwardProgress ?? 0;
      this.passForwardSum += fp;
      this.passForwardSamples++;
      if (fp >= 6) this.progressivePassCount++;
      else if (fp <= -2) this.backwardPassCount++;
      else this.lateralPassCount++;
    }
  }

  public onPassTryStart(windupSeconds?: number, recoverySeconds?: number): void {
    this.passTryStarts++;
    if (windupSeconds !== undefined && recoverySeconds !== undefined) {
      this.passWindupSum += windupSeconds;
      this.passRecoverySum += recoverySeconds;
      this.passTimingSamples++;
    }
  }

  public onPassReachedExecuting(): void {
    this.passReachedExecuting++;
  }

  public onPassResolved(
    realForwardGain: number,
    laneForwardProgress?: number,
    success: boolean = true,
  ): void {
    if (success) {
      this.passResolvedSuccess++;
      this.passRealGainSum += realForwardGain;
      this.passRealGainSamples++;
      if (realForwardGain >= 8) this.passEffectiveProgressive++;
      if (laneForwardProgress !== undefined) {
        this.laneVsRealAbsErrorSum += Math.abs(laneForwardProgress - realForwardGain);
      }
    } else {
      this.passResolvedFailure++;
    }
  }

  public finalize(): AttackFunnelReport {
    const poss = Math.max(1, this.possessionTicks);
    const totalDecisions = Object.values(this.possessionDecisions).reduce(
      (a, b) => a + b,
      0,
    );

    return {
      ticks: this.ticks,
      possessionTicks: this.possessionTicks,
      attackingThirdPossessionTicks: this.attackingThirdPossessionTicks,
      shootingZoneTicks: this.shootingZoneTicks,
      opponentHalfPossessionTicks: this.opponentHalfPossessionTicks,

      attackingThirdShareOfPossession:
        this.attackingThirdPossessionTicks / poss,
      shootingZoneShareOfPossession: this.shootingZoneTicks / poss,
      opponentHalfShareOfPossession: this.opponentHalfPossessionTicks / poss,
      ownershipRatio: this.ticks > 0 ? this.possessionTicks / this.ticks : 0,

      possessionDecisions: { ...this.possessionDecisions },
      possessionDecisionsInAttackingThird: {
        ...this.possessionDecisionsInAttackingThird,
      },
      possessionDecisionsInShootingZone: {
        ...this.possessionDecisionsInShootingZone,
      },

      totalPossessionDecisions: totalDecisions,
      shotDecisions: this.possessionDecisions["SHOT"] ?? 0,
      shotDecisionsInShootingZone:
        this.possessionDecisionsInShootingZone["SHOT"] ?? 0,
      passDecisions: this.possessionDecisions["PASS"] ?? 0,
      holdDecisions: this.possessionDecisions["HOLD_BALL"] ?? 0,
      dribbleDecisions: this.possessionDecisions["DRIBBLE"] ?? 0,

      avgGoalDistanceWhenInPossession:
        this.goalDistanceSamples > 0
          ? this.goalDistanceSum / this.goalDistanceSamples
          : 0,
      minGoalDistanceObserved: Number.isFinite(this.minGoalDistance)
        ? this.minGoalDistance
        : 0,

      avgSelectedPassForwardProgress:
        this.passForwardSamples > 0
          ? this.passForwardSum / this.passForwardSamples
          : 0,
      progressivePassCount: this.progressivePassCount,
      lateralPassCount: this.lateralPassCount,
      backwardPassCount: this.backwardPassCount,
      supportAheadShareOfPossession: this.supportAheadTicks / poss,

      avgPassRealForwardGain:
        this.passRealGainSamples > 0
          ? this.passRealGainSum / this.passRealGainSamples
          : 0,
      passEffectiveProgressiveRate:
        this.passRealGainSamples > 0
          ? this.passEffectiveProgressive / this.passRealGainSamples
          : 0,
      avgLaneVsRealAbsError:
        this.passRealGainSamples > 0
          ? this.laneVsRealAbsErrorSum / this.passRealGainSamples
          : 0,
      completedPassSamples: this.passRealGainSamples,
      avgTicksUntilOwnHalfReturn:
        this.ownHalfReturnSamples > 0
          ? this.ownHalfReturnSum / this.ownHalfReturnSamples
          : 0,
      ownHalfReturnSamples: this.ownHalfReturnSamples,

      passTryStarts: this.passTryStarts,
      passReachedExecuting: this.passReachedExecuting,
      passResolvedSuccess: this.passResolvedSuccess,
      passResolvedFailure: this.passResolvedFailure,
      passCompletionRatio:
        this.passTryStarts > 0
          ? this.passResolvedSuccess / this.passTryStarts
          : 0,
      carrierBusyTicks: this.carrierBusyTicks,
      carrierBusyShareOfPossession: this.carrierBusyTicks / poss,
      avgPassWindupSeconds:
        this.passTimingSamples > 0
          ? this.passWindupSum / this.passTimingSamples
          : 0,
      avgPassRecoverySeconds:
        this.passTimingSamples > 0
          ? this.passRecoverySum / this.passTimingSamples
          : 0,
    };
  }

  public static format(report: AttackFunnelReport): string {
    const top = (rec: Readonly<Record<string, number>>, n = 6) =>
      Object.entries(rec)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");

    return [
      "=== Attack funnel report ===",
      `ticks=${report.ticks} possessionTicks=${report.possessionTicks} ownership=${(report.ownershipRatio * 100).toFixed(1)}%`,
      `attackingThird: ${report.attackingThirdPossessionTicks} (${(report.attackingThirdShareOfPossession * 100).toFixed(1)}% of poss)`,
      `opponentHalf:   ${report.opponentHalfPossessionTicks} (${(report.opponentHalfShareOfPossession * 100).toFixed(1)}% of poss)`,
      `shootingZone≤${SHOOTING_ZONE_DISTANCE}m: ${report.shootingZoneTicks} (${(report.shootingZoneShareOfPossession * 100).toFixed(1)}% of poss)`,
      `supportAhead: ${(report.supportAheadShareOfPossession * 100).toFixed(1)}% of poss`,
      `carrierBusy: ${(report.carrierBusyShareOfPossession * 100).toFixed(1)}% of poss`,
      `PASS throughput: tryStart=${report.passTryStarts} executing=${report.passReachedExecuting} ok=${report.passResolvedSuccess} fail=${report.passResolvedFailure} ratio=${(report.passCompletionRatio * 100).toFixed(1)}%`,
      `PASS timing avg windup=${report.avgPassWindupSeconds.toFixed(3)}s recovery=${report.avgPassRecoverySeconds.toFixed(3)}s`,
      `avgGoalDist=${report.avgGoalDistanceWhenInPossession.toFixed(1)}m minGoalDist=${report.minGoalDistanceObserved.toFixed(1)}m`,
      `pass FP(lane)=${report.avgSelectedPassForwardProgress.toFixed(1)}m realΔx=${report.avgPassRealForwardGain.toFixed(1)}m |err|=${report.avgLaneVsRealAbsError.toFixed(1)} effective≥8m=${(report.passEffectiveProgressiveRate * 100).toFixed(1)}% n=${report.completedPassSamples}`,
      `ownHalfReturn avgTicks=${report.avgTicksUntilOwnHalfReturn.toFixed(1)} (n=${report.ownHalfReturnSamples})`,
      `decisions total=${report.totalPossessionDecisions} SHOT=${report.shotDecisions} PASS=${report.passDecisions} HOLD=${report.holdDecisions} DRIBBLE=${report.dribbleDecisions}`,
      `top decisions: ${top(report.possessionDecisions)}`,
    ].join("\n");
  }

  private bump(map: Record<string, number>, key: string): void {
    map[key] = (map[key] ?? 0) + 1;
  }

  private isAttackingThird(
    x: number,
    dir: 1 | -1,
    pitchLength: number,
  ): boolean {
    const third = pitchLength / 3;
    if (dir === 1) return x >= pitchLength - third;
    return x <= third;
  }

  private isOpponentHalf(
    x: number,
    dir: 1 | -1,
    pitchLength: number,
  ): boolean {
    const mid = pitchLength / 2;
    if (dir === 1) return x >= mid;
    return x <= mid;
  }
}

import type { MatchState } from "../../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../../core/movement/PlayerMatchState";
import type { PlayerIntent, PlayerIntentType } from "./TacticalIntelligenceTypes";

/** Owns intent lifecycle so a new simulation tick is never itself a cancel reason. */
export class PlayerIntentSystem {
  public update(match: MatchState): void {
    const effectiveTeamId = this.effectivePossessionTeamId(match);
    const motionId = this.motionId(match);
    for (const player of [...match.home.players, ...match.away.players]) {
      const intent = player.intent;
      if (!intent) continue;
      const ownTeam = match.home.players.includes(player) ? match.home : match.away;
      const expired = match.currentSecond >= intent.expiresAt;
      const possessionChanged = intent.cancelConditions.includes("possessionChanged")
        && intent.possessionTeamId !== undefined && effectiveTeamId !== null
        && effectiveTeamId !== intent.possessionTeamId;
      const trajectoryChanged = intent.cancelConditions.includes("ballTrajectoryChanged")
        && intent.ballMotionId !== undefined && motionId !== intent.ballMotionId;
      const occupied = intent.cancelConditions.includes("spaceOccupied") && intent.targetPosition
        ? ownTeam.players.some(other => other !== player && other.position.distanceTo(intent.targetPosition!) < 2)
        : false;
      if (expired || possessionChanged || trajectoryChanged || occupied) player.intent = null;
    }
  }

  public enforce(match: MatchState): void {
    for (const player of [...match.home.players, ...match.away.players]) {
      if (player.intent?.targetPosition && match.currentSecond < player.intent.expiresAt)
        player.setTarget(player.intent.targetPosition);
    }
  }

  public commit(
    match: MatchState,
    player: PlayerMatchState,
    input: Omit<PlayerIntent, "startedAt" | "possessionTeamId" | "ballMotionId">,
  ): PlayerIntent {
    const candidate: PlayerIntent = {
      ...input,
      startedAt: match.currentSecond,
      possessionTeamId: this.effectivePossessionTeamId(match) ?? undefined,
      ballMotionId: this.motionId(match),
    };
    const current = player.intent;
    if (current && current.type === candidate.type && current.commitment > candidate.commitment
      && match.currentSecond < current.expiresAt) return current;
    player.intent = candidate;
    if (candidate.targetPosition) player.setTarget(candidate.targetPosition);
    return candidate;
  }

  public inferFromResponsibility(match: MatchState, player: PlayerMatchState): void {
    if (player.intent && match.currentSecond < player.intent.expiresAt) return;
    const mapping: Partial<Record<string, PlayerIntentType>> = {
      ONE_TWO_RUN: "completeOneTwo", THIRD_MAN_RUN: "thirdManRun", THIRD_MAN_SUPPORT: "supportCarrier",
      OVERLAP: "overlap", UNDERLAP: "underlap", ATTACK_FAR_POST: "attackFarPost",
      PRESSER: "counterpress", PRESS_COVER: "protectZone", REST_DEFENCE: "protectZone",
      RECEIVE_RUN: "receiveBall", LOOSE_BALL_CHASER: "receiveBall",
    };
    const type = player.tacticalResponsibility ? mapping[player.tacticalResponsibility] : undefined;
    if (!type) return;
    this.commit(match, player, {
      type,
      targetPosition: player.targetPosition,
      expiresAt: Math.max(match.currentSecond + .4, player.responsibilityUntil),
      confidence: .78,
      commitment: .7,
      cancelConditions: ["possessionChanged", "spaceOccupied", "higherPriorityThreat", "expired"],
      reason: `collective responsibility ${player.tacticalResponsibility}`,
    });
  }

  private effectivePossessionTeamId(match: MatchState): string | null {
    if (match.ball.owner) return match.home.players.includes(match.ball.owner) ? match.home.team.id : match.away.team.id;
    // A pending pass is still an attacking-team action until physical control
    // resolves it. A transient loose-ball prediction must not cancel the
    // receiver's run while the ball is travelling toward that receiver.
    if (match.ball.pendingPass) {
      const passerId = match.ball.pendingPass.passerId;
      if (match.home.players.some(player => player.player.id === passerId)) return match.home.team.id;
      if (match.away.players.some(player => player.player.id === passerId)) return match.away.team.id;
    }
    if (match.home.possessionPrediction.likelyTeamId && match.home.possessionPrediction.confidence >= .55)
      return match.home.possessionPrediction.likelyTeamId;
    return null;
  }

  private motionId(match: MatchState): string | undefined {
    const motion = match.ball.motion;
    return motion ? `${motion.kind}:${motion.origin.x.toFixed(2)}:${motion.origin.y.toFixed(2)}:${motion.target.x.toFixed(2)}:${motion.target.y.toFixed(2)}` : undefined;
  }
}

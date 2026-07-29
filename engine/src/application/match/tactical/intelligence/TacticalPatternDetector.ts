import type { MatchState } from "../../../../core/movement/MatchState";
import type { TeamMatchState } from "../../../../core/movement/TeamMatchState";
import type { PlayerSpatioTemporalState, SpaceOpportunity, TacticalPatternDetection } from "./TacticalIntelligenceTypes";

export class TacticalPatternDetector {
  public detect(
    match: MatchState,
    team: TeamMatchState,
    players: ReadonlyMap<string, PlayerSpatioTemporalState>,
    spaces: readonly SpaceOpportunity[],
  ): TacticalPatternDetection[] {
    const own = team.players.map(player => players.get(player.player.id)!).filter(Boolean);
    const opponent = (team === match.home ? match.away : match.home).players
      .map(player => players.get(player.player.id)!).filter(Boolean);
    const patterns: TacticalPatternDetection[] = [];
    const ball = match.ball.position;
    const nearBall = own.filter(player => player.position.distanceTo(ball) < 12);
    const central = own.filter(player => Math.abs(player.position.y - match.pitch.width / 2) < 12);
    const left = own.filter(player => player.position.y < match.pitch.width / 3);
    const right = own.filter(player => player.position.y > match.pitch.width * 2 / 3);
    const behindBall = own.filter(player => (ball.x - player.position.x) * team.attackingDirection > 0);

    if (team.possessionState === "transitionToDefense" && nearBall.length >= 2)
      patterns.push(this.pattern("counterpress", .55 + nearBall.length * .08, nearBall, "ball-zone", ["loss probable", `${nearBall.length} players can press`]));
    if (team.collectivePhase === "COUNTER_ATTACK")
      patterns.push(this.pattern("counterAttack", .82, own.filter(player => player.velocity.magnitude() > 3.5), "forward-channel", ["collective counter phase"]));
    if (team.collectivePhase === "BUILD_UP")
      patterns.push(this.pattern("patientBuildUp", .72, own.filter(player => player.position.distanceTo(ball) < 25), "first-two-thirds", ["controlled build-up"]));
    if (central.length >= 5)
      patterns.push(this.pattern("centralOverload", clamp(.45 + central.length * .07), central, "centre", [`${central.length} central occupants`]));
    if (Math.max(left.length, right.length) >= 4) {
      const overloaded = left.length >= right.length ? left : right;
      patterns.push(this.pattern("wideOverload", clamp(.48 + overloaded.length * .08), overloaded, left.length >= right.length ? "left" : "right", [`${overloaded.length} wide occupants`]));
      const weakSide = spaces.filter(space => space.kind === "weakSide" && space.occupationRisk < .5);
      if (weakSide.length) patterns.push(this.pattern("switchOpportunity", .72, overloaded, "weak-side", ["wide overload", "opposite space available"]));
    }
    const highPlayers = own.filter(player => (player.position.x - match.pitch.length / 2) * team.attackingDirection > 10);
    if (team.possessionState === "defending" && highPlayers.length >= 4)
      patterns.push(this.pattern("highPress", clamp(.45 + highPlayers.length * .07), highPlayers, "opponent-half", [`${highPlayers.length} high defenders`]));
    if (behindBall.length >= 3 && team.possessionState !== "defending")
      patterns.push(this.pattern("restDefense", clamp(.5 + behindBall.length * .06), behindBall.slice(0, 4), "behind-ball", [`${behindBall.length} behind ball`]));
    for (const player of team.players) {
      if (player.tacticalResponsibility === "OVERLAP" || player.tacticalResponsibility === "UNDERLAP" || player.tacticalResponsibility === "THIRD_MAN_RUN") {
        const name = player.tacticalResponsibility === "OVERLAP" ? "overlap" : player.tacticalResponsibility === "UNDERLAP" ? "underlap" : "thirdManRun";
        patterns.push(this.pattern(name, .9, [players.get(player.player.id)!], "active-run", [player.tacticalResponsibility]));
      }
    }
    void opponent;
    return patterns;
  }

  private pattern(
    pattern: TacticalPatternDetection["pattern"], confidence: number,
    players: readonly PlayerSpatioTemporalState[], affectedZone: string, evidence: string[],
  ): TacticalPatternDetection {
    return { pattern, confidence: clamp(confidence), involvedPlayers: players.filter(Boolean).map(player => player.playerId), affectedZone, evidence };
  }
}

const clamp = (value: number, min = 0, max = 1): number => Math.max(min, Math.min(max, value));

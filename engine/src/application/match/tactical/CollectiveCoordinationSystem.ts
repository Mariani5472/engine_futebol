import { Vector2 } from "../../../core/geometry/Vector2";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";

type Channel = "LEFT" | "CENTRE" | "RIGHT";

/** Turns individual tactical intentions into deterministic collective relationships. */
export class CollectiveCoordinationSystem {
  public update(state: MatchState): void {
    this.clearExpired(state);
    const owner = state.ball.owner;
    if (!owner) {
      this.coordinateContestedBall(state);
      this.reserveSpaces(state, state.home);
      this.reserveSpaces(state, state.away);
      return;
    }
    const attacking = state.home.players.includes(owner) ? state.home : state.away;
    const defending = attacking === state.home ? state.away : state.home;
    this.coordinateDefence(state, defending, attacking, owner);
    this.coordinateAttack(state, attacking, owner);
    this.reserveSpaces(state, attacking);
    this.reserveSpaces(state, defending);
  }

  private coordinateDefence(state: MatchState, team: TeamMatchState, opponents: TeamMatchState, owner: PlayerMatchState): void {
    const candidates = team.players.filter(player => !this.isGoalkeeper(player))
      .sort((a, b) => a.position.distanceTo(owner.position) - b.position.distanceTo(owner.position));
    const trigger = team.collectivePhase === "DEFENSIVE_TRANSITION" || state.ball.velocity.magnitude() < 4 || candidates[0]?.position.distanceTo(owner.position) < 8;
    if (trigger && candidates[0]) {
      const presser = candidates[0];
      const approach = presser.position.subtract(owner.position).normalize();
      this.assign(presser, "PRESSER", owner.position.add((approach.magnitude() ? approach : new Vector2(-team.attackingDirection, 0)).multiply(1.25)), state, 1);
      if (candidates[1]) {
        const ownGoalDirection = new Vector2(-team.attackingDirection, 0);
        this.assign(candidates[1], "PRESS_COVER", owner.position.add(ownGoalDirection.multiply(4)).add(new Vector2(0, owner.position.y < state.pitch.width / 2 ? 2 : -2)), state, 1);
      }
      if (candidates[2]) {
        const option = opponents.players.filter(player => player !== owner)
          .sort((a, b) => a.position.distanceTo(owner.position) - b.position.distanceTo(owner.position))[0];
        const shadow = option ? owner.position.add(option.position.subtract(owner.position).multiply(.42))
          : owner.position.add(new Vector2(-team.attackingDirection * 2, 4));
        this.assign(candidates[2], "COVER_SHADOW", shadow, state, 1);
      }
    }
    this.coordinateDefensiveLine(state, team, new Set(candidates.slice(0, trigger ? 3 : 0)));
  }

  private coordinateDefensiveLine(state: MatchState, team: TeamMatchState, excluded: Set<PlayerMatchState>): void {
    const defenders = team.players.filter(player => this.isDefender(player) && !excluded.has(player));
    if (!defenders.length) return;
    const ballProgress = this.progress(state, team, state.ball.position.x);
    const base = team.collectivePhase === "DEFENSIVE_TRANSITION" ? ballProgress - 28 : ballProgress - 22;
    const lineProgress = Math.max(17, Math.min(50, base));
    for (const defender of defenders) {
      const x = this.toPitchX(state, team, lineProgress);
      this.assign(defender, "DEFENSIVE_LINE", new Vector2(x, defender.targetPosition.y), state, .8);
    }
  }

  private coordinateAttack(state: MatchState, team: TeamMatchState, owner: PlayerMatchState): void {
    this.assignRestDefence(state, team);
    this.assignThirdMan(state, team, owner);
    this.assignWideCombination(state, team, owner);
    if (team.collectivePhase === "FINAL_THIRD" || this.progress(state, team, state.ball.position.x) > state.pitch.length * .7) {
      this.assignBoxOccupation(state, team, owner);
    }
  }

  /**
   * Keep both teams alive while the ball is travelling or genuinely loose.
   * Only one player per team attacks the ball itself; the next players create
   * cover and an outlet so a second ball does not become a static 1-v-1.
   */
  private coordinateContestedBall(state: MatchState): void {
    const contestPoint = this.predictContestPoint(state);
    const passingTeam = this.teamOfPlayerId(state, state.ball.pendingPass?.passerId)
      ?? this.teamOfPlayerId(state, state.ball.intendedReceiverId)
      ?? state.attackingTeam;

    for (const team of [state.home, state.away]) {
      const outfield = team.players
        .filter(player => !this.isGoalkeeper(player))
        .sort((a, b) => a.position.distanceTo(contestPoint) - b.position.distanceTo(contestPoint));
      if (!outfield.length) continue;

      const intended = state.ball.intendedReceiverId
        ? outfield.find(player => player.player.id === state.ball.intendedReceiverId)
        : undefined;
      const claimant = intended ?? outfield[0];
      this.assign(
        claimant,
        intended ? "RECEIVE_RUN" : "LOOSE_BALL_CHASER",
        contestPoint,
        state,
        .8,
      );

      const remaining = outfield.filter(player => player !== claimant);
      const cover = remaining[0];
      if (cover) {
        const behind = team === passingTeam ? -team.attackingDirection : team.attackingDirection;
        this.assign(cover, "SECOND_BALL_COVER", this.clamp(state, contestPoint.add(new Vector2(behind * 5, this.lateralSide(cover, contestPoint) * 3))), state, .8);
      }

      const outlet = remaining.find(player => player !== cover && !this.isDefender(player));
      if (outlet) {
        const forward = team === passingTeam ? team.attackingDirection * 4 : -team.attackingDirection * 3;
        this.assign(outlet, "LOOSE_BALL_OUTLET", this.clamp(state, contestPoint.add(new Vector2(forward, this.lateralSide(outlet, contestPoint) * 8))), state, .8);
      }
    }
  }

  private predictContestPoint(state: MatchState): Vector2 {
    if (state.ball.motion) return state.ball.motion.target;
    const speed = state.ball.velocity.magnitude();
    const lookAhead = Math.min(1, speed > .1 ? 6 / speed : 0);
    return this.clamp(state, state.ball.position.add(state.ball.velocity.multiply(lookAhead)));
  }

  private assignRestDefence(state: MatchState, team: TeamMatchState): void {
    const ballProgress = this.progress(state, team, state.ball.position.x);
    const centreBacks = team.players.filter(player => String(player.currentRole).includes("CENTRE_BACK"));
    const restProgress = Math.max(20, Math.min(50, ballProgress - 22));
    centreBacks.slice(0, 2).forEach((player, index) => this.assign(player, "REST_DEFENCE", new Vector2(
      this.toPitchX(state, team, restProgress), state.pitch.width / 2 + (index === 0 ? -8 : 8),
    ), state, 1.2));
    const holder = team.players.find(player => String(player.currentRole).includes("DEFENSIVE_MID"));
    if (holder) this.assign(holder, "REST_DEFENCE_SCREEN", new Vector2(this.toPitchX(state, team, Math.min(ballProgress - 12, 58)), state.pitch.width / 2), state, 1.2);
  }

  private assignThirdMan(state: MatchState, team: TeamMatchState, owner: PlayerMatchState): void {
    const options = team.players.filter(player => player !== owner && !this.isGoalkeeper(player));
    const support = options.filter(player => player.position.distanceTo(owner.position) <= 18)
      .sort((a, b) => a.position.distanceTo(owner.position) - b.position.distanceTo(owner.position))[0];
    const runner = options.filter(player => player !== support && !this.isDefender(player))
      .sort((a, b) => this.progress(state, team, b.position.x) - this.progress(state, team, a.position.x))[0];
    if (!support || !runner) return;
    support.thirdManOriginId = owner.player.id;
    support.thirdManNextTargetId = runner.player.id;
    support.thirdManAvailableUntil = state.currentSecond + 2.4;
    const ownerToSupport = support.position.subtract(owner.position);
    const supportSide = ownerToSupport.y >= 0 ? 1 : -1;
    const supportTarget = owner.position.add(new Vector2(-team.attackingDirection * 4, supportSide * 7));
    this.assign(support, "THIRD_MAN_SUPPORT", this.clamp(state, supportTarget), state, 1.2);
    const side = runner.position.y <= state.pitch.width / 2 ? -1 : 1;
    this.assign(runner, "THIRD_MAN_RUN", new Vector2(
      this.toPitchX(state, team, Math.min(96, this.progress(state, team, state.ball.position.x) + 13)),
      Math.max(5, Math.min(state.pitch.width - 5, runner.tacticalAnchorPosition.y + side * 4)),
    ), state, 1.2);
  }

  private assignWideCombination(state: MatchState, team: TeamMatchState, owner: PlayerMatchState): void {
    const fullbacks = team.players.filter(player => String(player.currentRole).includes("FULL_BACK") || String(player.currentRole).includes("WING_BACK"));
    const widePlayers = team.players.filter(player => this.isWideAttacker(player));
    for (const fullback of fullbacks) {
      // Flank identity comes from the formation, never from a temporary run.
      // Otherwise an underlap can cross the centre and turn both fullbacks
      // into players from the same side on the following tick.
      const sideLeft = fullback.tacticalAnchorPosition.y < state.pitch.width / 2;
      const ballSideLeft = state.ball.position.y < state.pitch.width / 2;
      const winger = widePlayers.filter(player => (player.tacticalAnchorPosition.y < state.pitch.width / 2) === sideLeft)
        .sort((a, b) => a.position.distanceTo(fullback.position) - b.position.distanceTo(fullback.position))[0];
      if (!winger || fullback === owner) continue;
      if (sideLeft !== ballSideLeft) {
        const ballProgress = this.progress(state, team, state.ball.position.x);
        this.assign(fullback, "FAR_SIDE_BALANCE", new Vector2(
          this.toPitchX(state, team, Math.max(24, Math.min(62, ballProgress - 10))),
          state.pitch.width / 2 + (sideLeft ? -11 : 11),
        ), state, 1.5);
        continue;
      }
      const wingerWide = sideLeft ? winger.tacticalAnchorPosition.y < 17 : winger.tacticalAnchorPosition.y > state.pitch.width - 17;
      const progress = Math.min(92, this.progress(state, team, state.ball.position.x) + 8);
      const y = wingerWide ? state.pitch.width / 2 + (sideLeft ? -9 : 9) : (sideLeft ? 5 : state.pitch.width - 5);
      this.assign(fullback, wingerWide ? "UNDERLAP" : "OVERLAP", new Vector2(this.toPitchX(state, team, progress), y), state, 1.5);
      if (this.progress(state, team, fullback.targetPosition.x) > this.progress(state, team, winger.targetPosition.x)) {
        this.label(winger, "TEMPORARY_FLANK_COVER", state, 1.5);
      }
    }
  }

  private assignBoxOccupation(state: MatchState, team: TeamMatchState, owner: PlayerMatchState): void {
    const attackers = team.players.filter(player => player !== owner && !this.isGoalkeeper(player) && !this.isDefender(player))
      .sort((a, b) => this.progress(state, team, b.position.x) - this.progress(state, team, a.position.x));
    const nearPostProgress = state.pitch.length - 9;
    const farPostProgress = state.pitch.length - 12;
    const centre = state.pitch.width / 2;
    const ballOnLeft = state.ball.position.y < centre;
    if (attackers[0]) this.assign(attackers[0], "ATTACK_NEAR_POST", new Vector2(this.toPitchX(state, team, nearPostProgress), centre + (ballOnLeft ? -3.5 : 3.5)), state, 1);
    if (attackers[1]) this.assign(attackers[1], "ATTACK_FAR_POST", new Vector2(this.toPitchX(state, team, farPostProgress), centre + (ballOnLeft ? 6 : -6)), state, 1);
    if (attackers[2]) this.assign(attackers[2], "BOX_EDGE_COVER", new Vector2(this.toPitchX(state, team, state.pitch.length - 18), centre), state, 1);
  }

  private reserveSpaces(state: MatchState, team: TeamMatchState): void {
    const reservations = new Map<string, PlayerMatchState>();
    for (const player of team.players.filter(player => !player.hasBall)) {
      let target = player.targetPosition;
      let channel = this.channel(target.y, state.pitch.width);
      const band = Math.floor(this.progress(state, team, target.x) / 10);
      let key = `${band}:${channel}`;
      const occupied = reservations.get(key);
      if (occupied && target.distanceTo(occupied.targetPosition) < 5) {
        const preferredSide = player.tacticalAnchorPosition.y <= occupied.tacticalAnchorPosition.y ? -1 : 1;
        target = this.clamp(state, target.add(new Vector2(0, preferredSide * 4)));
        channel = this.channel(target.y, state.pitch.width);
        key = `${band}:${channel}`;
        player.setTarget(target);
      }
      player.occupiedChannel = channel; reservations.set(key, player);
    }
  }

  private assign(player: PlayerMatchState, responsibility: string, target: Vector2, state: MatchState, seconds: number): void {
    player.tacticalResponsibility = responsibility; player.responsibilityUntil = state.currentSecond + seconds; player.setTarget(target);
  }
  private label(player: PlayerMatchState, responsibility: string, state: MatchState, seconds: number): void {
    player.tacticalResponsibility = responsibility; player.responsibilityUntil = state.currentSecond + seconds;
  }
  private clearExpired(state: MatchState): void {
    for (const player of [...state.home.players, ...state.away.players]) {
      if (state.currentSecond >= player.responsibilityUntil) player.tacticalResponsibility = null;
      if (state.currentSecond >= player.thirdManAvailableUntil) {
        player.thirdManOriginId = null;
        player.thirdManNextTargetId = null;
      }
    }
  }
  private progress(state: MatchState, team: TeamMatchState, x: number): number { return team.attackingDirection === 1 ? x : state.pitch.length - x; }
  private toPitchX(state: MatchState, team: TeamMatchState, progress: number): number { return team.attackingDirection === 1 ? progress : state.pitch.length - progress; }
  private teamOfPlayerId(state: MatchState, playerId: string | null | undefined): TeamMatchState | null {
    if (!playerId) return null;
    if (state.home.players.some(player => player.player.id === playerId)) return state.home;
    if (state.away.players.some(player => player.player.id === playerId)) return state.away;
    return null;
  }
  private lateralSide(player: PlayerMatchState, point: Vector2): number { return player.position.y < point.y ? -1 : 1; }
  private clamp(state: MatchState, point: Vector2): Vector2 { return new Vector2(Math.max(2, Math.min(state.pitch.length - 2, point.x)), Math.max(2, Math.min(state.pitch.width - 2, point.y))); }
  private channel(y: number, width: number): Channel { return y < width / 3 ? "LEFT" : y > width * 2 / 3 ? "RIGHT" : "CENTRE"; }
  private isGoalkeeper(player: PlayerMatchState): boolean { return String(player.currentRole).includes("GOALKEEPER"); }
  private isDefender(player: PlayerMatchState): boolean { const role = String(player.currentRole); return role.includes("BACK") || role.includes("DEFENDER"); }
  private isWideAttacker(player: PlayerMatchState): boolean { const role = String(player.currentRole); return role.includes("WIDE") || role.includes("WINGER") || role.includes("INSIDE_FORWARD"); }
}

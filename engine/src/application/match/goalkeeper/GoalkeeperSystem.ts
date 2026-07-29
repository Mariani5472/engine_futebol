import { Vector2 } from "../../../core/geometry/Vector2";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";

/** Spatial positioning and reaction intentions. MovementSystem executes them. */
export class GoalkeeperSystem {
  public update(state: MatchState): void {
    this.updateTeam(state, state.home);
    this.updateTeam(state, state.away);
  }

  private updateTeam(state: MatchState, team: TeamMatchState): void {
    const goalkeeper = team.players.find(player => player.currentRole.includes("GOALKEEPER"));
    if (!goalkeeper) return;

    const ownGoalX = team.attackingDirection === 1 ? 0 : state.pitch.length;
    const goal = ownGoalX === 0 ? state.pitch.geometry.leftGoal : state.pitch.geometry.rightGoal;
    const shot = state.ball.activeShot;

    if (shot && shot.defendingTeamId === team.team.id && shot.lifecycle !== "RESOLVED") {
      this.reactToShot(state, goalkeeper, goal.center.x, goal.center.y, goal.width);
      return;
    }

    goalkeeper.goalkeeperInterceptionTarget = null;
    const opponentOwnsBall = state.ball.owner && !team.players.includes(state.ball.owner);
    const distanceFromGoal = Math.abs(state.ball.position.x - ownGoalX);
    const rushingQuality = goalkeeper.player.attributes.goalkeeping.rushingOut / 20;
    const canRush = opponentOwnsBall && distanceFromGoal < 15
      && goalkeeper.position.distanceTo(state.ball.position) < 11
      && rushingQuality >= .58;

    if (canRush) {
      goalkeeper.goalkeeperState = "RUSHING_OUT";
      goalkeeper.setTarget(state.ball.position);
      return;
    }

    const lateralRatio = Math.max(-1, Math.min(1, (state.ball.position.y - goal.center.y) / (state.pitch.width / 2)));
    const protectedY = goal.center.y + lateralRatio * (goal.width / 2 - .45);
    const advance = Math.max(.7, Math.min(4, 4 - distanceFromGoal / 18));
    const targetX = ownGoalX + team.attackingDirection * advance;
    goalkeeper.goalkeeperState = distanceFromGoal < 24 ? "CLOSING_ANGLE" : "POSITIONING";
    goalkeeper.setTarget(new Vector2(targetX, protectedY));
  }

  private reactToShot(
    state: MatchState,
    goalkeeper: PlayerMatchState,
    goalX: number,
    centreY: number,
    goalWidth: number,
  ): void {
    const shot = state.ball.activeShot!;
    if (!goalkeeper.goalkeeperInterceptionTarget) {
      const reflexes = goalkeeper.player.attributes.goalkeeping.reflexes / 20;
      const anticipation = goalkeeper.player.attributes.mental.anticipation / 20;
      const concentration = goalkeeper.player.attributes.mental.concentration / 20;
      const reactionSeconds = Math.max(.12, .48 - reflexes * .18 - anticipation * .08 - concentration * .05);
      goalkeeper.goalkeeperReactionUntil = state.currentSecond + reactionSeconds;
      goalkeeper.goalkeeperCommittedAt = state.currentSecond;
      const targetY = Math.max(centreY - goalWidth / 2, Math.min(centreY + goalWidth / 2, shot.actualTarget.y));
      const fieldSide = goalX === 0 ? 1 : -1;
      goalkeeper.goalkeeperInterceptionTarget = new Vector2(goalX + fieldSide * .55, targetY);
      goalkeeper.goalkeeperState = "SET";
    }

    if (state.currentSecond < goalkeeper.goalkeeperReactionUntil) {
      goalkeeper.velocity = goalkeeper.velocity.multiply(.6);
      return;
    }

    const target = goalkeeper.goalkeeperInterceptionTarget;
    if (!target) return;
    goalkeeper.goalkeeperState = Math.abs(target.y - goalkeeper.position.y) > .85 ? "DIVING" : "CATCHING";
    goalkeeper.setTarget(target);
  }
}

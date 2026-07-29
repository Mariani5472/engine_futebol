import { Vector2 } from "../../../core/geometry/Vector2";
import type { MatchState } from "../../../core/movement/MatchState";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";
import { ENGINE_CALIBRATION_PARAMETERS } from "../calibration/CalibrationParameters";

const SHOT_CALIBRATION = ENGINE_CALIBRATION_PARAMETERS.shot;

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

    if (!shot && state.currentSecond < goalkeeper.goalkeeperStateUntil) {
      if (goalkeeper.goalkeeperState === "PARRYING" || goalkeeper.goalkeeperState === "DIVING") {
        goalkeeper.goalkeeperState = "RECOVERING";
        goalkeeper.velocity = goalkeeper.velocity.multiply(.72);
      }
      return;
    }
    if (!shot && goalkeeper.goalkeeperState === "RECOVERING") {
      goalkeeper.goalkeeperState = "POSITIONING";
      goalkeeper.goalkeeperDiveOrigin = null;
    }

    if (shot && shot.defendingTeamId === team.team.id && shot.lifecycle !== "RESOLVED") {
      this.reactToShot(state, goalkeeper, goal.center.x, goal.center.y, goal.width);
      return;
    }

    goalkeeper.goalkeeperInterceptionTarget = null;
    goalkeeper.goalkeeperInterceptionHeight = null;
    const opponentOwnsBall = state.ball.owner && !team.players.includes(state.ball.owner);
    const distanceFromGoal = Math.abs(state.ball.position.x - ownGoalX);
    const rushingQuality = goalkeeper.player.attributes.goalkeeping.rushingOut / 20;
    const goalkeeperDistance = goalkeeper.position.distanceTo(state.ball.position);
    const goalkeeperEta = goalkeeperDistance / Math.max(3.5, goalkeeper.player.attributes.physical.acceleration * .35);
    // A carrier already touches the ball, so distance-to-ball would always be
    // zero. Compare the goalkeeper arrival against the carrier's next useful
    // touch/shot window instead.
    const attackerControl = (state.ball.owner?.player.attributes.technical.firstTouch ?? 10) / 20;
    const attackerEta = .75 + (1-attackerControl)*.8;
    const canRush = opponentOwnsBall && distanceFromGoal < 15
      && goalkeeperDistance < 11 && goalkeeperEta <= attackerEta + .45
      && rushingQuality >= .58;

    if (canRush) {
      goalkeeper.goalkeeperState = goalkeeperDistance < 2.1 ? "SMOTHERING" : "RUSHING_OUT";
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
      const reactionSeconds = Math.max(
        SHOT_CALIBRATION.goalkeeperMinimumReactionSeconds,
        SHOT_CALIBRATION.goalkeeperReactionBaseSeconds
          - reflexes * SHOT_CALIBRATION.goalkeeperReactionReflexScaleSeconds
          - anticipation * SHOT_CALIBRATION.goalkeeperReactionAnticipationScaleSeconds
          - concentration * SHOT_CALIBRATION.goalkeeperReactionConcentrationScaleSeconds,
      );
      goalkeeper.goalkeeperReactionUntil = state.currentSecond + reactionSeconds;
      shot.goalkeeperReactionTime=reactionSeconds;
      shot.goalkeeperDecision="SET";
      goalkeeper.goalkeeperCommittedAt = state.currentSecond;
      goalkeeper.goalkeeperDiveOrigin = goalkeeper.position;
      const targetY = Math.max(centreY - goalWidth / 2, Math.min(centreY + goalWidth / 2, shot.actualTarget.y));
      const fieldSide = goalX === 0 ? 1 : -1;
      goalkeeper.goalkeeperInterceptionTarget = new Vector2(goalX + fieldSide * .55, targetY);
      goalkeeper.goalkeeperInterceptionHeight = Math.max(0, Math.min(shot.goalFrame.topZ, shot.actualTarget.z));
      goalkeeper.goalkeeperState = "SET";
    }

    if (state.currentSecond < goalkeeper.goalkeeperReactionUntil) {
      goalkeeper.velocity = goalkeeper.velocity.multiply(.6);
      return;
    }

    const target = goalkeeper.goalkeeperInterceptionTarget;
    if (!target) return;
    goalkeeper.goalkeeperState = Math.abs(target.y - goalkeeper.position.y) > .85
      || (goalkeeper.goalkeeperInterceptionHeight ?? 0) > 1.15
      ? "DIVING"
      : "CATCHING";
    shot.goalkeeperDecision=goalkeeper.goalkeeperState;
    goalkeeper.goalkeeperStateUntil = state.currentSecond + .7;
    goalkeeper.setTarget(target);
  }
}

import type { MatchState } from "../../../core/movement/MatchState";
import type { Vector2 } from "../../../core/geometry/Vector2";
import type { PlayerMatchState } from "../../../core/movement/PlayerMatchState";
import type { PossessionPrediction, TeamPossessionState } from "../../../core/movement/PossessionPrediction";
import type { TeamMatchState } from "../../../core/movement/TeamMatchState";

const PHASE_CONFIRMATION_SECONDS = .15;

interface Candidate { state: TeamPossessionState; since: number }

/** Predicts the next controlled touch from physical arrival times. */
export class PossessionPredictionSystem {
  private readonly candidates = new Map<string, Candidate>();

  public update(state: MatchState): void {
    if (state.ball.owner) {
      const ownerTeam = state.home.players.includes(state.ball.owner) ? state.home : state.away;
      const other = ownerTeam === state.home ? state.away : state.home;
      const prediction: PossessionPrediction = {
        likelyTeamId: ownerTeam.team.id,
        likelyReceiverId: state.ball.owner.player.id,
        confidence: 1,
        estimatedControlTime: 0,
        interceptionRisk: 0,
        state: "controlled",
        estimatedArrivalTimes: { [state.ball.owner.player.id]: 0 },
        transitionReason: "PHYSICAL_CONTROL",
      };
      ownerTeam.possessionPrediction = prediction;
      other.possessionPrediction = prediction;
      this.commit(ownerTeam, "controlledPossession", state.currentSecond, true);
      this.commit(other, "defending", state.currentSecond, true);
      return;
    }

    const intended = state.ball.intendedReceiverId
      ? this.player(state, state.ball.intendedReceiverId)
      : null;
    if (!intended || !state.ball.motion) {
      const prediction: PossessionPrediction = {
        confidence: 0.5, interceptionRisk: 0.5, state: "contested",
        estimatedArrivalTimes: {}, transitionReason: state.ball.activeShot ? "SHOT_IN_FLIGHT" : "LOOSE_BALL",
      };
      state.home.possessionPrediction = prediction;
      state.away.possessionPrediction = prediction;
      this.commit(state.home, "contestedPossession", state.currentSecond);
      this.commit(state.away, "contestedPossession", state.currentSecond);
      return;
    }

    const passingTeam = state.home.players.includes(intended) ? state.home : state.away;
    const defending = passingTeam === state.home ? state.away : state.home;
    const target = state.ball.motion.target;
    const ballEta = Math.max(0, state.ball.motion.duration - state.ball.motion.elapsed);
    const receiverEta = this.arrivalSeconds(intended, target);
    const defenderEtas = defending.players.map(player => [player.player.id, this.arrivalSeconds(player, target)] as const);
    const closestDefender = defenderEtas.slice().sort((a,b)=>a[1]-b[1])[0];
    const receiverControlEta = Math.max(ballEta, receiverEta);
    const margin = (closestDefender?.[1] ?? 99) - receiverControlEta;
    const confidence = clamp(.5 + margin / 3, .05, .97);
    const likelyTurnover = margin < -.15;
    const contested = Math.abs(margin) <= .3;
    const likelyTeam = likelyTurnover ? defending : passingTeam;
    const likelyReceiver = likelyTurnover ? closestDefender?.[0] : intended.player.id;
    const prediction: PossessionPrediction = {
      likelyTeamId: contested ? undefined : likelyTeam.team.id,
      likelyReceiverId: contested ? undefined : likelyReceiver,
      confidence: contested ? Math.max(.5, 1 - Math.abs(margin)) : likelyTurnover ? 1-confidence : confidence,
      estimatedControlTime: Math.min(receiverControlEta, closestDefender?.[1] ?? 99),
      interceptionRisk: clamp(1-confidence, .03, .97),
      state: contested ? "contested" : likelyTurnover ? "likelyTurnover" : "probable",
      estimatedArrivalTimes: Object.fromEntries([[intended.player.id, receiverControlEta], ...defenderEtas]),
      transitionReason: contested ? "ARRIVAL_TIMES_OVERLAP" : likelyTurnover ? "OPPONENT_ARRIVES_FIRST" : "INTENDED_RECEIVER_FAVOURED",
    };
    passingTeam.possessionPrediction = prediction;
    defending.possessionPrediction = prediction;
    if (contested) {
      this.commit(passingTeam, "contestedPossession", state.currentSecond);
      this.commit(defending, "contestedPossession", state.currentSecond);
    } else if (likelyTurnover) {
      this.commit(passingTeam, "transitionToDefense", state.currentSecond);
      this.commit(defending, "transitionToAttack", state.currentSecond);
    } else {
      this.commit(passingTeam, "probablePossession", state.currentSecond);
      this.commit(defending, "defending", state.currentSecond);
    }
  }

  private commit(team: TeamMatchState, next: TeamPossessionState, second: number, immediate = false): void {
    if (team.possessionState === next) { this.candidates.delete(team.team.id); return; }
    const candidate = this.candidates.get(team.team.id);
    if (!candidate || candidate.state !== next) {
      this.candidates.set(team.team.id, { state:next, since:second });
      if (!immediate) return;
    }
    const active = this.candidates.get(team.team.id)!;
    if (immediate || second-active.since+1e-9 >= PHASE_CONFIRMATION_SECONDS) {
      team.possessionState = next;
      this.candidates.delete(team.team.id);
    }
  }

  private arrivalSeconds(player:PlayerMatchState,target:Vector2):number {
    const distance=player.position.distanceTo(target);
    const pace=Number(player.player.attributes.physical.pace??10);
    const topSpeed=5.2+pace/20*3.1;
    const initial=Math.min(topSpeed,player.velocity.magnitude());
    const acceleration=3.8;
    const accelerationTime=Math.max(0,(topSpeed-initial)/acceleration);
    const accelerationDistance=initial*accelerationTime+.5*acceleration*accelerationTime*accelerationTime;
    if(distance<=accelerationDistance)return (-initial+Math.sqrt(initial*initial+2*acceleration*distance))/acceleration;
    return accelerationTime+(distance-accelerationDistance)/topSpeed;
  }

  private player(state:MatchState,id:string):PlayerMatchState|null {
    return [...state.home.players,...state.away.players].find(player=>player.player.id===id)??null;
  }
}

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

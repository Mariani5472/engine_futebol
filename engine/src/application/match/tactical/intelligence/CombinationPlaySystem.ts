import type { MatchState } from "../../../../core/movement/MatchState";
import type { TeamMatchState } from "../../../../core/movement/TeamMatchState";
import type { CombinationPlayContext, TacticalLane } from "./TacticalIntelligenceTypes";

/** Detects associative opportunities; it never guarantees their execution. */
export class CombinationPlaySystem {
  public detect(match: MatchState, team: TeamMatchState, lanes: readonly TacticalLane[]): CombinationPlayContext[] {
    const result: CombinationPlayContext[] = [];
    for (const player of team.players) {
      if (player.oneTwoPartnerId && player.oneTwoAvailableUntil > match.currentSecond) {
        const returnLane = lanes.find(lane => lane.fromPlayerId === player.oneTwoPartnerId && lane.toPlayerId === player.player.id);
        result.push({
          type:"oneTwo", initiatorId:player.player.id, receiverId:player.oneTwoPartnerId,
          availableReturnLane:Boolean(returnLane?.clearAtArrival), defenderDisplaced:(returnLane?.arrivalMargin ?? -1) > .25,
          progressionGain:returnLane?.progression ?? 0,
          completionProbability:this.probability(returnLane), expiresAt:player.oneTwoAvailableUntil,
        });
      }
    }

    const owner = match.ball.owner && team.players.includes(match.ball.owner) ? match.ball.owner : undefined;
    if (owner) {
      const firstLanes = lanes.filter(lane => lane.fromPlayerId === owner.player.id && lane.toPlayerId && lane.clearAtArrival);
      for (const first of firstLanes.slice(0, 5)) {
        const second = lanes.filter(lane => lane.fromPlayerId === first.toPlayerId && lane.toPlayerId !== owner.player.id
          && lane.toPlayerId && lane.clearAtArrival && lane.progression > 3)
          .sort((a,b) => b.progression + b.arrivalMargin * 3 - a.progression - a.arrivalMargin * 3)[0];
        if (!second) continue;
        result.push({
          type:"thirdMan", initiatorId:owner.player.id, receiverId:first.toPlayerId!, thirdPlayerId:second.toPlayerId,
          availableReturnLane:true, defenderDisplaced:first.arrivalMargin > .15,
          progressionGain:first.progression + second.progression,
          completionProbability:clamp(this.probability(first) * this.probability(second), .03, .92),
          expiresAt:match.currentSecond + 2.5,
        });
      }
    }

    for (const a of team.players) {
      const outgoing = lanes.filter(lane => lane.fromPlayerId === a.player.id && lane.toPlayerId && lane.clearAtArrival);
      for (const ab of outgoing.slice(0, 3)) {
        const bc = lanes.find(lane => lane.fromPlayerId === ab.toPlayerId && lane.toPlayerId && lane.toPlayerId !== a.player.id && lane.clearAtArrival);
        if (!bc) continue;
        const ca = lanes.find(lane => lane.fromPlayerId === bc.toPlayerId && lane.toPlayerId === a.player.id && lane.clearAtArrival);
        if (!ca) continue;
        result.push({ type:"triangulation", initiatorId:a.player.id, receiverId:ab.toPlayerId!, thirdPlayerId:bc.toPlayerId,
          availableReturnLane:true, defenderDisplaced:Math.max(ab.arrivalMargin,bc.arrivalMargin)>.2,
          progressionGain:ab.progression+bc.progression, completionProbability:clamp(this.probability(ab)*this.probability(bc),.03,.9),
          expiresAt:match.currentSecond+2 });
      }
    }
    const unique = new Map<string, CombinationPlayContext>();
    for (const item of result) unique.set(`${item.type}:${item.initiatorId}:${item.receiverId}:${item.thirdPlayerId??""}`, item);
    return [...unique.values()].sort((a,b)=>b.completionProbability-a.completionProbability).slice(0,16);
  }

  private probability(lane?: TacticalLane): number {
    return lane ? clamp(.5 + lane.arrivalMargin * .22 + (lane.clearAtArrival ? .15 : -.3), .05, .95) : .05;
  }
}

const clamp=(value:number,min:number,max:number):number=>Math.max(min,Math.min(max,value));

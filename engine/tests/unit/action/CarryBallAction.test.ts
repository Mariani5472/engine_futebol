import { DribbleAction } from "../../../src/application/match/action/actions/DribbleAction";
import { BallPhysicsSystem } from "../../../src/application/match/physics/BallPhysicsSystem";
import { Decision } from "../../../src/application/match/decision/Decision";
import { DecisionType } from "../../../src/application/match/decision/DecisionType";
import { MovementSystem } from "../../../src/core/movement/MovementSystem";
import { BallState } from "../../../src/core/movement/BallMatchState";
import { SeededRandom } from "../../../src/core/random/SeededRandom";
import { buildMinimalMatchState } from "../../helpers/builders";

describe("continuous carry",()=>{
  it("publishes mode/speed/purpose and ends only after physical arrival",()=>{
    const match=buildMinimalMatchState();
    const carrier=match.home.players[0];
    for(const opponent of match.away.players) opponent.position=opponent.position.add({x:40,y:0} as any);
    carrier.hasBall=true; match.ball.owner=carrier; match.ball.state=BallState.CONTROLLED; match.ball.position=carrier.position;
    const result=new DribbleAction().execute({
      player:carrier,decision:new Decision(DecisionType.DRIBBLE,80),match,pitch:match.pitch,
      random:new SeededRandom(2),tick:1,deltaTime:.05,teamSide:"HOME",attackingDirection:1,matchSecond:4,
    });
    const started=result.events[0];
    expect(started.type).toBe("CARRY_STARTED");
    if(started.type!=="CARRY_STARTED") throw new Error("missing carry event");
    expect(["CLOSE","NORMAL","SPRINT"]).toContain(started.controlMode);
    expect(started.desiredSpeed).toBeGreaterThan(2);
    expect(carrier.activeCarry).not.toBeNull();
    const movement=new MovementSystem(), physics=new BallPhysicsSystem();
    const events=[] as ReturnType<BallPhysicsSystem["update"]>;
    for(let tick=0;tick<200&&!events.some(event=>event.type==="CARRY_ENDED");tick++) {
      movement.update(match,.05); match.currentSecond+=.05; events.push(...physics.update(match,.05));
      expect(match.ball.position.distanceTo(carrier.position)).toBeLessThan(.75);
    }
    expect(events.some(event=>event.type==="CARRY_ENDED")).toBe(true);
    expect(carrier.activeCarry).toBeNull();
  });
});

import { createAttributeValue as A } from "../../engine/src/domain/common.js";
import { Player } from "../../engine/src/domain/player.js";
import { Team } from "../../engine/src/domain/team.js";
import { Tactic } from "../../engine/src/domain/tactics.js";
import { Pitch } from "../../engine/src/domain/pitch.js";
import { Referee } from "../../engine/src/domain/referee.js";
import type { SimulationConfig } from "../../engine/src/application/match/engine/SimulationConfig.js";

const attributes = () => ({
  mental: Object.fromEntries(["aggression","anticipation","bravery","composure","concentration","decisions","determination","flair","leadership","offTheBall","positioning","teamwork","vision","workRate"].map(k=>[k,A(10)])),
  physical: Object.fromEntries(["acceleration","agility","balance","jumpingReach","naturalFitness","pace","strength","stamina"].map(k=>[k,A(10)])),
  technical: Object.fromEntries(["corners","crossing","dribbling","finishing","firstTouch","freeKickTaking","heading","longShots","longThrows","marking","passing","penaltyTaking","tackling","technique"].map(k=>[k,A(10)])),
  goalkeeping: Object.fromEntries(["aerialReach","commandOfArea","communication","eccentricity","handling","kicking","oneOnOnes","reflexes","rushingOut","tendencyToPunch","throwing"].map(k=>[k,A(10)])),
  hidden: Object.fromEntries(["adaptability","ambition","consistency","dirtiness","importantMatches","injuryProneness","loyalty","pressure","professionalism","sportsmanship","temperament","versatility"].map(k=>[k,A(10)])),
}) as any;

const positions = ["GK","DC","DC","DL","DR","MC","MC","MC","WL","ST","WR"] as const;
const roles = ["GOALKEEPER","CENTRE_BACK","CENTRE_BACK","FULL_BACK","FULL_BACK","CENTRAL_MIDFIELDER","CENTRAL_MIDFIELDER","CENTRAL_MIDFIELDER","WINGER","STRIKER","WINGER"] as const;
const anchors = [[4,34],[20,27],[20,41],[22,10],[22,58],[40,20],[38,34],[40,48],[48,10],[49,34],[48,58]] as const;

function team(id: string): Team {
  return Team.create({ id:id as any, name:id === "home" ? "Aurora FC" : "Racing Sul", players:positions.map((position,i)=>Player.create({
    id:`${id}-${i+1}` as any, name:`${id} ${i+1}`, age:25, preferredFoot:"RIGHT",
    positions:[position], positionFamiliarity:[{position,familiarity:A(15)}], attributes:attributes(),
    languages:["PT" as any], personality:{adaptability:A(10),ambition:A(10),loyalty:A(10),professionalism:A(10),pressure:A(10),sportsmanship:A(10),temperament:A(10)}, relationships:[],
  })) });
}

function tactic(): Tactic {
  const assignments = positions.map((position,i)=>({ id:`slot-${i}`, position, role:roles[i],
    defensiveAnchor:{x:anchors[i][0],y:anchors[i][1]},
    attackingAnchor:{x:Math.min(82,anchors[i][0]+(i>7?28:i>4?20:10)),y:anchors[i][1]}, width:10,depth:10,freedom:4,
  }));
  const shape={name:"4-3-3",assignments};
  return Tactic.create({defensiveShape:shape,attackingShape:shape,teamInstructions:{instructions:[]},playerInstructions:[],familiarity:75});
}

export function createMatchConfig(id: string, seed = 1): SimulationConfig {
  const sharedTactic=tactic();
  return { id:id as any, homeTeam:team("home"), awayTeam:team("away"), pitch:Pitch.createStandard(),
    referee:Referee.create({id:"ref-1" as any,name:"Referee",strictness:50,consistency:70,advantageTendency:40}),
    seed,homeTactic:sharedTactic,awayTactic:sharedTactic,tickDeltaSeconds:.05,maxDurationSeconds:90*60,debugDecisions:true };
}

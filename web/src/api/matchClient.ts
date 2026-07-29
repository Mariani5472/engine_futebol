import type { GoalReplay } from "../simulation/types";
import type { RawNetworkSnapshot } from "../debug/observability";

const API_URL = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:3000`;

export function getOrCreateMatch(seed=1):Promise<{id:string}>{
  return fetch(`${API_URL}/matches`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({seed})}).then(async response=>{
    if(!response.ok)throw new Error(`Could not create match: ${response.status}`);
    return response.json() as Promise<{id:string}>;
  });
}

export async function recoverMatch(id:string,seed:number):Promise<{id:string}>{
  try{const response=await fetch(`${API_URL}/matches/${id}`);if(response.ok)return {id};}catch{/* recreate below */}
  return getOrCreateMatch(seed);
}

export function subscribeToMatch(id:string,handlers:{onSnapshot:(snapshot:RawNetworkSnapshot)=>void;onSpeedChanged:(speed:1|2|4|8|50)=>void}):WebSocket{
  const url=new URL(API_URL);url.protocol=url.protocol==="https:"?"wss:":"ws:";url.pathname=`/matches/${id}/stream`;
  const socket=new WebSocket(url);
  socket.addEventListener("message",event=>{
    const wire=JSON.parse(event.data) as RawNetworkSnapshot|{type:"speed_changed";speed:1|2|4|8|50};
    if(wire.type==="speed_changed"){handlers.onSpeedChanged(wire.speed);return;}
    handlers.onSnapshot(wire);
  });
  return socket;
}

export async function controlMatch(id:string,action:"pause"|"resume"):Promise<void>{
  const response=await fetch(`${API_URL}/matches/${id}/${action}`,{method:"POST"});if(!response.ok)throw new Error(`Could not ${action} match: ${response.status}`);
}
export async function setMatchSpeed(id:string,speed:1|2|4|8|50):Promise<void>{
  const response=await fetch(`${API_URL}/matches/${id}/speed`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({speed})});if(!response.ok)throw new Error(`Could not set match speed: ${response.status}`);
}
export async function stepMatch(id:string,count=1):Promise<void>{
  const response=await fetch(`${API_URL}/matches/${id}/step`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({count})});if(!response.ok)throw new Error(`Could not step match: ${response.status}`);
}
export async function getGoalReplay(id:string,goalEventId:string):Promise<GoalReplay>{
  const response=await fetch(`${API_URL}/matches/${id}/replays/${goalEventId}`);if(!response.ok)throw new Error(`Could not load replay: ${response.status}`);return response.json() as Promise<GoalReplay>;
}

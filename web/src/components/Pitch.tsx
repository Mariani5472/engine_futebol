import { useState } from "react";
import type { MatchSnapshot } from "../simulation/types";
import { interpolatePoint } from "../simulation/types";

export interface PitchLayers {
  readonly influence: boolean;
  readonly targets: boolean;
  readonly passingLines: boolean;
  readonly pressure: boolean;
  readonly anchors: boolean;
  readonly sectorLines: boolean;
  readonly roles: boolean;
  readonly logicalBall: boolean;
}

interface PitchProps {
  readonly previous: MatchSnapshot;
  readonly current: MatchSnapshot;
  readonly alpha: number;
  readonly layers: PitchLayers;
}

export function Pitch({ previous, current, alpha, layers }: PitchProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ball = interpolatePoint(previous.ball, current.ball, alpha);
  const ballHeight = (previous.ball.height ?? 0) + ((current.ball.height ?? 0) - (previous.ball.height ?? 0)) * alpha;
  const owner = current.players.find(player => player.id === current.tacticalDebug?.carrierId) ?? current.players.find(player => player.hasBall);
  const passOptions = new Set(current.tacticalDebug?.passOptionIds ?? []);
  const camera=current.replayCamera;
  return <div className="pitch-shell"><div className="pitch-stage"><div className="pitch" aria-label="Campo de futebol 2D" style={camera?{transformOrigin:`${camera.centerX}% ${camera.centerY}%`,transform:`scale(${camera.zoom})`}:undefined}>
    <div className="halfway"/><div className="center-circle"/><div className="center-dot"/>
    <div className="box box-left"/><div className="box box-right"/><div className="goal goal-left"/><div className="goal goal-right"/>
    <svg className="pitch-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {layers.passingLines && owner && current.players.filter(player=>passOptions.has(player.id)).map(player=><line key={`pass-${player.id}`} x1={owner.x} y1={owner.y} x2={player.x} y2={player.y} className="pass-line"/>)}
      {layers.targets && current.players.map(player=>player.targetPosition&&<g key={`target-${player.id}`}><line x1={player.x} y1={player.y} x2={player.targetPosition.x} y2={player.targetPosition.y} className="target-line"/><circle cx={player.targetPosition.x} cy={player.targetPosition.y} r=".65" className="target-dot"/></g>)}
      {layers.anchors && current.players.map(player=>player.tacticalAnchorPosition&&<g key={`anchor-${player.id}`}><line x1={player.tacticalAnchorPosition.x} y1={player.tacticalAnchorPosition.y} x2={player.x} y2={player.y} className="anchor-line"/><circle cx={player.tacticalAnchorPosition.x} cy={player.tacticalAnchorPosition.y} r=".75" className="anchor-dot"/></g>)}
      {layers.sectorLines && current.tacticalDebug && <><SectorLine sectors={current.tacticalDebug.homeSectors} className="sector-line sector-home"/><SectorLine sectors={current.tacticalDebug.awaySectors} className="sector-line sector-away"/></>}
    </svg>
    {current.players.map((player,index)=>{
      const old=previous.players.find(candidate=>candidate.id===player.id)??player;
      const point=interpolatePoint(old,player,alpha);
      const underPressure=!player.hasBall&&Math.hypot(player.x-ball.x,player.y-ball.y)<12;
      return <div className={`player ${player.team==="HOME"?"player-home":"player-away"} ${selectedId===player.id?"player-selected":""} ${owner?.id===player.id?"player-carrier":""}`} key={player.id} style={{left:`${point.x}%`,top:`${point.y}%`}} onClick={()=>setSelectedId(selectedId===player.id?null:player.id)} title={`${player.role??"Jogador"} ${player.number}${player.goalkeeperState?` · ${player.goalkeeperState}`:player.tacticalResponsibility?` · ${player.tacticalResponsibility}`:""}`}>
        {layers.influence&&<i className="influence-area"/>}{layers.pressure&&underPressure&&<i className="pressure-area"/>}{player.hasBall&&<i className="possession-ring"/>}<span>{player.number}</span>{layers.roles&&<small className="role-label">{formatRole(player.goalkeeperState??player.tacticalResponsibility??player.role)}</small>}
      </div>;
    })}
    <div className="ball" data-motion={current.ball.motionKind ?? "NONE"} style={{left:`${ball.x}%`,top:`${ball.y}%`,transform:`translate(-50%, calc(-50% - ${ballHeight * 3}px))`}}/>
    {layers.logicalBall&&current.ball.logicalPosition&&<div className="logical-ball" style={{left:`${current.ball.logicalPosition.x}%`,top:`${current.ball.logicalPosition.y}%`}} title="Posição lógica da bola"/>}
  </div></div></div>;
}

function SectorLine({sectors,className}:{sectors:{defence:{x:number;y:number}|null;midfield:{x:number;y:number}|null;attack:{x:number;y:number}|null};className:string}) {
  const points=[sectors.defence,sectors.midfield,sectors.attack].filter((point):point is {x:number;y:number}=>point!==null).map(point=>`${point.x},${point.y}`).join(" ");
  return points ? <polyline points={points} className={className}/> : null;
}
const formatRole=(role?:string)=>role?.replaceAll("_"," ").toLowerCase()??"";

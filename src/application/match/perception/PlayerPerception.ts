import { PitchZoneId } from "../../../domain";
import { BallPerception } from "./BallPerception";
import { PerceivedEntity } from "./PerceivedEntity";

export interface PlayerPerception {
  playerId: string;
  currentZone: PitchZoneId;
  ball: BallPerception;
  teammates: PerceivedEntity[];
  opponents: PerceivedEntity[];
}
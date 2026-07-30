import { ActionEvaluator } from "../ActionEvaluator";
import { BlockEvaluator } from "../evaluators/BlockEvaluator";
import { ControlEvaluator } from "../evaluators/ControlEvaluator";
import { CoverEvaluator } from "../evaluators/CoverEvaluator";
import { GKClaimEvaluator } from "../evaluators/GKClaimEvaluator";
import { HeaderEvaluator } from "../evaluators/HeaderEvaluator";
import { InterceptEvaluator } from "../evaluators/InterceptEvaluator";
import { MarkEvaluator } from "../evaluators/MarkEvaluator";
import { MoveEvaluator } from "../evaluators/MoveEvaluator";
import { PositionEvaluator } from "../evaluators/PositionEvaluator";
import { PressEvaluator } from "../evaluators/PressEvaluator";
import { ReceiveEvaluator } from "../evaluators/ReceiveEvaluator";
import { TackleEvaluator } from "../evaluators/TackleEvaluator";
import { TacticalFoulEvaluator } from "../evaluators/TacticalFoulEvaluator";

export function createOffBallEvaluators(): ActionEvaluator[] {
  return [
    new PressEvaluator(),
    new CoverEvaluator(),
    new TackleEvaluator(),
    new TacticalFoulEvaluator(),
    new BlockEvaluator(),
    new InterceptEvaluator(),
    new GKClaimEvaluator(),
    new ReceiveEvaluator(),
    new HeaderEvaluator(),
    new ControlEvaluator(),
    new PositionEvaluator(),
    new MoveEvaluator(),
    new MarkEvaluator(),
  ];
}

import { ActionEvaluator } from "../ActionEvaluator";
import { ControlEvaluator } from "../evaluators/ControlEvaluator";
import { CoverEvaluator } from "../evaluators/CoverEvaluator";
import { HeaderEvaluator } from "../evaluators/HeaderEvaluator";
import { InterceptEvaluator } from "../evaluators/InterceptEvaluator";
import { MarkEvaluator } from "../evaluators/MarkEvaluator";
import { MoveEvaluator } from "../evaluators/MoveEvaluator";
import { PressEvaluator } from "../evaluators/PressEvaluator";
import { ReceiveEvaluator } from "../evaluators/ReceiveEvaluator";
import { TackleEvaluator } from "../evaluators/TackleEvaluator";

export function createOffBallEvaluators(): ActionEvaluator[] {
  return [
    new PressEvaluator(),
    new CoverEvaluator(),
    new TackleEvaluator(),
    new InterceptEvaluator(),
    new ReceiveEvaluator(),
    new HeaderEvaluator(),
    new ControlEvaluator(),
    new MoveEvaluator(),
    new MarkEvaluator(),
  ];
}

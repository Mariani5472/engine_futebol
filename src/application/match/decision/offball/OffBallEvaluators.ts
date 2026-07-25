import { ActionEvaluator } from "../ActionEvaluator";
import { ControlEvaluator } from "../evaluators/ControlEvaluator";
import { CoverEvaluator } from "../evaluators/CoverEvaluator";
import { HeaderEvaluator } from "../evaluators/HeaderEvaluator";
import { PressEvaluator } from "../evaluators/PressEvaluator";
import { ReceiveEvaluator } from "../evaluators/ReceiveEvaluator";
import { TackleEvaluator } from "../evaluators/TackleEvaluator";

export function createOffBallEvaluators(): ActionEvaluator[] {
  return [
    new PressEvaluator(),
    new CoverEvaluator(),
    new TackleEvaluator(),
    new ReceiveEvaluator(),
    new HeaderEvaluator(),
    new ControlEvaluator(),
  ];
}

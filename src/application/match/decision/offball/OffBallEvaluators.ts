import { ActionEvaluator } from "../ActionEvaluator";
import { TackleEvaluator } from "../evaluators/TackleEvaluator";
import { PressEvaluator } from "../evaluators/PressEvaluator";
import { CoverEvaluator } from "../evaluators/CoverEvaluator";

export function createOffBallEvaluators(): ActionEvaluator[] {
  return [
    new PressEvaluator(),
    new CoverEvaluator(),
    new TackleEvaluator(),
  ];
}

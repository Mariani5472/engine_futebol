import { ActionEvaluator } from "../ActionEvaluator";
import { ClearEvaluator } from "../evaluators/ClearEvaluator";
import { CrossEvaluator } from "../evaluators/CrossEvaluator";
import { PassEvaluator } from "../evaluators/PassEvaluator";
import { ShotEvaluator } from "../evaluators/ShotEvaluator";
import { DribbleEvaluator } from "../evaluators/DribbleEvaluator";
import { HoldBallEvaluator } from "../evaluators/HoldBallEvaluator";

export function createPossessionEvaluators(): ActionEvaluator[] {
  return [
    new PassEvaluator(),
    new CrossEvaluator(),
    new ShotEvaluator(),
    new DribbleEvaluator(),
    new HoldBallEvaluator(),
    new ClearEvaluator(),
  ];
}

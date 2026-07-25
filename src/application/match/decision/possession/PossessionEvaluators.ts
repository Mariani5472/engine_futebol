import { ActionEvaluator } from "../ActionEvaluator";
import { PassEvaluator } from "../evaluators/PassEvaluator";
import { ShotEvaluator } from "../evaluators/ShotEvaluator";
import { DribbleEvaluator } from "../evaluators/DribbleEvaluator";
import { HoldBallEvaluator } from "../evaluators/HoldBallEvaluator";

export function createPossessionEvaluators(): ActionEvaluator[] {
  return [
    new PassEvaluator(),
    new ShotEvaluator(),
    new DribbleEvaluator(),
    new HoldBallEvaluator(),
  ];
}

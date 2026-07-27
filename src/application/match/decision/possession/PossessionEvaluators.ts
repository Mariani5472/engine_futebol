import { ActionEvaluator } from "../ActionEvaluator";
import { ClearEvaluator } from "../evaluators/ClearEvaluator";
import { CrossEvaluator } from "../evaluators/CrossEvaluator";
import { FakeEvaluator } from "../evaluators/FakeEvaluator";
import { GKDistributeEvaluator } from "../evaluators/GKDistributeEvaluator";
import { PassEvaluator } from "../evaluators/PassEvaluator";
import { SetPieceEvaluator } from "../evaluators/SetPieceEvaluator";
import { SkillMoveEvaluator } from "../evaluators/SkillMoveEvaluator";
import { ShotEvaluator } from "../evaluators/ShotEvaluator";
import { DribbleEvaluator } from "../evaluators/DribbleEvaluator";
import { HoldBallEvaluator } from "../evaluators/HoldBallEvaluator";

export function createPossessionEvaluators(): ActionEvaluator[] {
  return [
    new PassEvaluator(),
    new CrossEvaluator(),
    new ShotEvaluator(),
    new DribbleEvaluator(),
    new SkillMoveEvaluator(),
    new FakeEvaluator(),
    new GKDistributeEvaluator(),
    new SetPieceEvaluator(),
    new HoldBallEvaluator(),
    new ClearEvaluator(),
  ];
}

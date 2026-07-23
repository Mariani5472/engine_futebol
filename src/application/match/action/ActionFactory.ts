import { Decision } from "../decision/Decision";
import { DecisionType } from "../decision/DecisionType";
import { ActionContext } from "./ActionContext";
import { ActionResult } from "./ActionResult";
import { ClearanceAction } from "./actions/ClearanceAction";
import { DribbleAction } from "./actions/DribbleAction";
import { HeaderAction } from "./actions/HeaderAction";
import { HoldBallAction } from "./actions/HoldBallAction";
import { PassAction } from "./actions/PassAction";
import { ShotAction } from "./actions/ShotAction";
import { TackleAction } from "./actions/TackleAction";
import { RefereeSystem } from "../referee/RefereeSystem";

/**
 * Routes a Decision to its corresponding action implementation
 * and executes it within the given context.
 */
export class ActionFactory {

  private readonly pass = new PassAction();
  private readonly shot = new ShotAction();
  private readonly dribble = new DribbleAction();
  private readonly header = new HeaderAction();
  private readonly clearance = new ClearanceAction();
  private readonly holdBall = new HoldBallAction();
  private readonly tackle: TackleAction;

  constructor(referee: RefereeSystem) {
    this.tackle = new TackleAction(referee);
  }

  public execute(
    decision: Decision,
    context: ActionContext
  ): ActionResult {

    switch (decision.type) {

      case DecisionType.PASS:
        return this.pass.execute(context);

      case DecisionType.SHOT:
        return this.shot.execute(context);

      case DecisionType.DRIBBLE:
        return this.dribble.execute(context);

      case DecisionType.TACKLE:
        return this.tackle.execute(context);

      case DecisionType.CLEAR:
        return this.clearance.execute(context);

      case DecisionType.HOLD_BALL:
        return this.holdBall.execute(context);

      // Defensive non-action types: set target via tactical/team behaviour,
      // no discrete action to execute here.
      case DecisionType.PRESS:
      case DecisionType.MARK:
      case DecisionType.COVER:
      case DecisionType.RECEIVE:
      case DecisionType.MOVE:
        return { actorId: context.player.player.id, type: decision.type, success: true, events: [] };

      default:
        return { actorId: context.player.player.id, type: DecisionType.NONE, success: false, events: [] };

    }

  }

}

import { ActionEvaluator } from "./ActionEvaluator";
import { Decision } from "./Decision";
import { DecisionContext } from "./DecisionContext";
import { DecisionCooldown } from "./DecisionCooldown";
import { DecisionFilter } from "./DecisionFilter";
import { DecisionHysteresis } from "./DecisionHysteresis";
import { DecisionSelector } from "./DecisionSelector";
import { DecisionType } from "./DecisionType";
import { EvaluatedDecision } from "./EvaluatedDecision";
import { RiskCalculator } from "./risk/RiskCalculator";
import { RiskScore } from "./risk/RiskScore";
import { UtilityCalculator } from "./UtilityCalculator";
import { UtilityScore } from "./UtilityScore";

export class DecisionSystem {

  private current: EvaluatedDecision | null = null;

  constructor(
    private readonly evaluators: ActionEvaluator[],
    private readonly filter: DecisionFilter,
    private readonly utility: UtilityCalculator,
    private readonly risk: RiskCalculator,
    private readonly selector: DecisionSelector,
    private readonly cooldown: DecisionCooldown,
    private readonly hysteresis: DecisionHysteresis
  ) {}

  public decide(context: DecisionContext): Decision {

    const candidates = this.generateCandidates(
      context
    );

    const legal = this.filter.filter(
      candidates,
      context
    );

    if (legal.length === 0) {
      return this.fallback();
    }

    const evaluated = legal.map(decision => this.evaluate(
      decision,
      context
    ));

    const available = evaluated.filter(candidate => !this.cooldown.isBlocked(
      candidate.decision.type,
      context.currentTick
    ));

    if (available.length === 0) {
      return this.fallback();
    }

    const best = this.selectBest(available);

    if (!this.hysteresis.shouldSwitch(this.current, best)) {

      return this.current!.decision;
    }

    this.current =
      best;

    this.cooldown.block(
      best.decision.type,
      context.currentTick
    );

    return best.decision;
  }

  private generateCandidates(
    context: DecisionContext
  ): Decision[] {

    return this.evaluators.flatMap(
      evaluator => evaluator.generate(context)
    );
  }

  private evaluate(
    decision: Decision,
    context: DecisionContext
  ): EvaluatedDecision {

    const utility =
      this.utility.calculate(
        this.createUtilityContext(
          decision,
          context
        )
      );

    const risk =
      this.risk.calculate(
        this.createRiskContext(
          decision,
          context
        )
      );

    return new EvaluatedDecision(
      decision,
      utility,
      risk,
      this.createReason(
        utility,
        risk
      )
    );
  }

  private selectBest(
    decisions: EvaluatedDecision[]
  ): EvaluatedDecision {

    return decisions.reduce(
      (
        best,
        current
      ) =>
        current.finalScore >
          best.finalScore
          ? current
          : best
    );
  }

  private fallback(): Decision {
    return new Decision(
      DecisionType.HOLD_BALL,
      0
    );
  }

  private createReason(
    utility: UtilityScore,
    risk: RiskScore
  ): string {

    return [
      `UTILITY:${utility.total}`,
      `RISK:${risk.total}`,
    ].join("|");
  }
}
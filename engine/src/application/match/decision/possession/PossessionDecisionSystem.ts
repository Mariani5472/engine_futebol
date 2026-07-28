import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionDebug, globalDecisionDebug } from "../DecisionDebug";
import { DecisionFilter } from "../DecisionFilter";
import { DecisionSelector } from "../DecisionSelector";
import { EvaluatedDecision } from "../EvaluatedDecision";
import { DefaultPersonalityModifier } from "../personality/DefaultPersonalityModifier";
import { PersonalityModifier } from "../personality/PersonalityModifier";
import { DefaultRiskCalculator } from "../risk/DefaultRiskCalculator";
import { RiskCalculator } from "../risk/RiskCalculator";
import { RiskContext } from "../risk/RiskContext";
import { FieldThirdResolver } from "../../../../core/pitch/FieldThirdResolver";
import { ActionReadiness } from "../evaluators/ActionReadiness";
import { applyRoleDecisionModifier } from "../RoleDecisionModifier";
import { applyTacticalInstructionDecisionModifier } from "../TacticalInstructionDecisionModifier";

export class PossessionDecisionSystem {
  private readonly fieldThirdResolver: FieldThirdResolver;
  private readonly personalityModifier: PersonalityModifier;
  private readonly riskCalculator: RiskCalculator;
  private readonly debug: DecisionDebug;

  constructor(
    private readonly evaluators: ActionEvaluator[],
    private readonly filter: DecisionFilter = new DecisionFilter(),
    private readonly selector: DecisionSelector = new DecisionSelector(),
    personalityModifier?: PersonalityModifier,
    riskCalculator?: RiskCalculator,
    pitchLength: number = 105,
    debug: DecisionDebug = globalDecisionDebug,
  ) {
    this.personalityModifier = personalityModifier ?? new DefaultPersonalityModifier();
    this.riskCalculator = riskCalculator ?? new DefaultRiskCalculator();
    this.fieldThirdResolver = new FieldThirdResolver(pitchLength);
    this.debug = debug;
  }

  public decide(context: DecisionContext): Decision {
    const candidates: Decision[] = [];

    for (const evaluator of this.evaluators) {
      candidates.push(...evaluator.evaluate(context));
    }

    const readyCandidates = candidates.filter(() =>
      ActionReadiness.canStartAction(context)
    );

    const biasedCandidates = readyCandidates.map((decision) => {
      const bias = this.personalityModifier.calculate({
        player: context.player,
        decisionType: decision.type,
      });

      return {
        decision: applyTacticalInstructionDecisionModifier(applyRoleDecisionModifier(new Decision(
          decision.type,
          decision.utility + bias.utilityModifier,
          decision.targetId,
          decision.reasons,
          decision.components,
        ), context), context),
        riskToleranceModifier: bias.riskToleranceModifier,
      };
    });

    const valid = this.filter.filter(
      biasedCandidates.map((candidate) => candidate.decision),
      context
    );

    const teamMatchState = context.match.home.players.includes(context.player)
      ? context.match.home
      : context.match.away;

    const fieldThird = this.fieldThirdResolver.resolve(
      context.player.position,
      teamMatchState.attackingDirection
    );

    const evaluated: EvaluatedDecision[] = valid.map((decision) => {
      const riskToleranceModifier = biasedCandidates.find(
        (candidate) =>
          candidate.decision.type === decision.type &&
          candidate.decision.targetId === decision.targetId
      )?.riskToleranceModifier ?? 0;

      const riskContext = new RiskContext(
        decision,
        context.player,
        context,
        fieldThird,
        riskToleranceModifier
      );

      const risk = this.riskCalculator.calculate(riskContext);
      return new EvaluatedDecision(decision, risk);
    });

    const best = this.selector.select(evaluated);

    this.debug.record(context.player, best.decision, {
      tick: context.currentTick,
      matchSecond: context.currentTick * context.deltaTime,
    });

    return best.decision;
  }
}

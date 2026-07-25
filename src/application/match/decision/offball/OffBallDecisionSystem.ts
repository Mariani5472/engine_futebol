import { ActionEvaluator } from "../ActionEvaluator";
import { Decision } from "../Decision";
import { DecisionContext } from "../DecisionContext";
import { DecisionFilter } from "../DecisionFilter";
import { DecisionSelector } from "../DecisionSelector";
import { EvaluatedDecision } from "../EvaluatedDecision";
import { DefaultPersonalityModifier } from "../personality/DefaultPersonalityModifier";
import { PersonalityModifier } from "../personality/PersonalityModifier";
import { DefaultRiskCalculator } from "../risk/DefaultRiskCalculator";
import { RiskCalculator } from "../risk/RiskCalculator";
import { RiskContext } from "../risk/RiskContext";
import { FieldThirdResolver } from "../../../../core/pitch/FieldThirdResolver";
import { PlayerPosition } from "../../../../domain";

export class OffBallDecisionSystem {
  private readonly fieldThirdResolver: FieldThirdResolver;
  private readonly personalityModifier: PersonalityModifier;
  private readonly riskCalculator: RiskCalculator;

  constructor(
    private readonly evaluators: ActionEvaluator[],
    private readonly filter: DecisionFilter = new DecisionFilter(),
    private readonly selector: DecisionSelector = new DecisionSelector(),
    personalityModifier?: PersonalityModifier,
    riskCalculator?: RiskCalculator,
    pitchLength: number = 105
  ) {
    this.personalityModifier = personalityModifier ?? new DefaultPersonalityModifier();
    this.riskCalculator = riskCalculator ?? new DefaultRiskCalculator();
    this.fieldThirdResolver = new FieldThirdResolver(pitchLength);
  }

  public decide(context: DecisionContext): Decision {
    const candidates: Decision[] = [];

    for (const evaluator of this.evaluators) {
      candidates.push(...evaluator.evaluate(context));
    }

    const biasedCandidates = candidates.map((decision) => {
      const bias = this.personalityModifier.calculate({
        player: context.player,
        decisionType: decision.type,
      });

      return {
        decision: new Decision(
          decision.type,
          decision.utility + bias.utilityModifier,
          decision.targetId
        ),
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
    return best.decision;
  }
}

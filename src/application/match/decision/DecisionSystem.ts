import { FieldThirdResolver } from "../../../core/pitch/FieldThirdResolver";
import { ActionEvaluator } from "./ActionEvaluator";
import { Decision } from "./Decision";
import { DecisionContext } from "./DecisionContext";
import { DecisionFilter } from "./DecisionFilter";
import { DecisionSelector } from "./DecisionSelector";
import { EvaluatedDecision } from "./EvaluatedDecision";
import { DefaultPersonalityModifier } from "./personality/DefaultPersonalityModifier";
import { PersonalityModifier } from "./personality/PersonalityModifier";
import { DefaultRiskCalculator } from "./risk/DefaultRiskCalculator";
import { RiskCalculator } from "./risk/RiskCalculator";
import { RiskContext } from "./risk/RiskContext";

export class DecisionSystem {

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

    // Apply personality bias to each candidate's utility.
    const biasedCandidates = candidates.map(decision => {
      const bias = this.personalityModifier.calculate({
        player: context.player,
        decisionType: decision.type
      });

      return new Decision(
        decision.type,
        decision.utility + bias.utilityModifier,
        decision.targetId
      );
    });

    // Legal filter (also provides fallback).
    const valid = this.filter.filter(biasedCandidates, context);

    // Evaluate risk for each valid decision and score by utility – risk.
    const teamMatchState = context.match.home.players.includes(context.player)
      ? context.match.home
      : context.match.away;

    const fieldThird = this.fieldThirdResolver.resolve(
      context.player.position,
      teamMatchState.attackingDirection
    );

    const evaluated: EvaluatedDecision[] = valid.map(decision => {
      const riskContext = new RiskContext(
        decision,
        context.player,
        context,
        fieldThird
      );
      const risk = this.riskCalculator.calculate(riskContext);
      return new EvaluatedDecision(decision, risk);
    });

    // Select the decision with the highest final score (utility - risk.total).
    const best = evaluated.reduce((a, b) =>
      b.finalScore > a.finalScore ? b : a
    );

    return best.decision;

  }

}

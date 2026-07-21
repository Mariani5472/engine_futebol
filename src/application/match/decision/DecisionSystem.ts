export class DecisionSystem {

  constructor(
    private readonly evaluators: ActionEvaluator[]
  ) {}

  public decide(
    context: DecisionContext
  ): Decision {

    const decisions: Decision[] = [];

    for (
      const evaluator
      of this.evaluators
    ) {

      decisions.push(
        ...evaluator.evaluate(
          context
        )
      );

    }

    if (
      decisions.length === 0
    ) {

      throw new Error(
        "No decision candidates available"
      );

    }

    return decisions.reduce(
      (best, current) => {

        const bestScore =
          best.utility -
          best.risk;

        const currentScore =
          current.utility -
          current.risk;

        return currentScore >
          bestScore

          ? current
          : best;

      }
    );

  }

}
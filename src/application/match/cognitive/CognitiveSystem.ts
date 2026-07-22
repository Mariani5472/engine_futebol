import { MemorySystem } from "../awareness/memory/MemorySystem";
import { PredictionSystem } from "../awareness/prediction/PredictionSystem";
import { CognitiveContext } from "./CognitiveContext";
import { NoiseSystem } from "./NoiseSystem";

export class CognitiveSystem {
  constructor(
    private readonly noise: NoiseSystem,
    private readonly memory: MemorySystem,
    private readonly prediction: PredictionSystem
  ) {}

  public update(
    context: CognitiveContext
  ): void {
    this.noise.update(context);
    this.memory.update(context);
    this.prediction.update(context);
  }
}
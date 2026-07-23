import { BallMemory } from "./BallMemory";
import { BallPrediction } from "../prediction/BallPrediction";
import { PlayerMemory } from "./PlayerMemory";
import { PlayerPrediction } from "../prediction/PlayerPrediction";
import { Vector2 } from "../../../../core/geometry/Vector2";
export class PlayerAwareness {
  constructor(
    public readonly playerId: string,
    public readonly teammates:
      Map<string, PlayerMemory>,
    public readonly opponents:
      Map<string, PlayerMemory>,
    public readonly teammatePredictions:
      Map<string, PlayerPrediction>,
    public readonly opponentPredictions:
      Map<string, PlayerPrediction>,
    public readonly ball:
      BallMemory,
    public ballPrediction:
      BallPrediction
  ) {}
  public static create(
    playerId: string
  ): PlayerAwareness {
    return new PlayerAwareness(
      playerId,
      new Map(),
      new Map(),
      new Map(),
      new Map(),
      new BallMemory(
        Vector2.zero(),
        Vector2.zero(),
        0,
        0,
        0,
        0
      ),
      new BallPrediction(
        Vector2.zero(),
        Vector2.zero(),
        0
      )
    );
  }
}
import { AttributeValue } from "../../../../domain";

const MAX_CERTAINTY_DECAY_RATE = 0.30;
const MAX_CONCENTRATION = 20;

/**
 * Models how a player's confidence in a previously observed
 * position fades once that observation is no longer refreshed.
 *
 * Concentration slows the decay: a highly concentrated player
 * holds on to what they last saw for longer before doubting it.
 */
export class MemoryDecay {

  public calculateCertainty(
    certainty: number,
    concentration: AttributeValue,
    deltaTime: number
  ): number {

    const concentrationModifier = concentration / MAX_CONCENTRATION;
    const decayRate = MAX_CERTAINTY_DECAY_RATE * (1 - concentrationModifier);

    return Math.max(0, certainty * Math.exp(
      -decayRate *
      deltaTime
    ));
  }
}
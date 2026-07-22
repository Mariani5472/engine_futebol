import { PersonalityBias } from "./PersonalityBias";
import { PersonalityContext } from "./PersonalityContext";

export interface PersonalityModifier {
  calculate(context: PersonalityContext): PersonalityBias;
}
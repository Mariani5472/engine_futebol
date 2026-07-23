import {
  AttributeValue,
  createAttributeValue,
} from "./common";
export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 20;
export class AttributeRange {
  public static normalize(value: number): AttributeValue {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Attribute value must be a finite number. Received: ${value}`
      );
    }
    const rounded = Math.round(value);
    const clamped = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, rounded));
    return createAttributeValue(clamped);
  }
  public static validate(value: number): asserts value is AttributeValue {
    if (
      !Number.isInteger(value) ||
      value < ATTRIBUTE_MIN ||
      value > ATTRIBUTE_MAX
    ) {
      throw new Error(
        `Attribute value must be an integer between ` +
        `${ATTRIBUTE_MIN} and ${ATTRIBUTE_MAX}. ` +
        `Received: ${value}`
      );
    }
  }
  public static isValid(value: number): boolean {
    return (
      Number.isInteger(value) &&
      value >= ATTRIBUTE_MIN &&
      value <= ATTRIBUTE_MAX
    );
  }
  public static create(value: number): AttributeValue {
    this.validate(value);
    return createAttributeValue(value);
  }
}
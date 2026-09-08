/** A small seeded PRNG based on mulberry32. It never calls Math.random(). */
export class Random {
  private state: number;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) throw new Error("seed must be a finite number.");
    this.state = seed >>> 0;
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error("int requires integer bounds with min <= max.");
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(probability: number): boolean {
    if (probability < 0 || probability > 1 || !Number.isFinite(probability)) {
      throw new Error("chance probability must be between 0 and 1.");
    }
    return this.next() < probability;
  }
}

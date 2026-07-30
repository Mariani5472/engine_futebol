import { Vector2 } from "../../../src/core/geometry/Vector2";

describe("Vector2", () => {
  describe("construction", () => {
    it("stores x and y", () => {
      const v = new Vector2(3, 4);
      expect(v.x).toBe(3);
      expect(v.y).toBe(4);
    });

    it("zero() returns (0, 0)", () => {
      const v = Vector2.zero();
      expect(v.x).toBe(0);
      expect(v.y).toBe(0);
    });
  });

  describe("arithmetic", () => {
    it("add", () => {
      const a = new Vector2(1, 2);
      const b = new Vector2(3, 4);
      const result = a.add(b);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });

    it("subtract", () => {
      const a = new Vector2(5, 7);
      const b = new Vector2(2, 3);
      const result = a.subtract(b);
      expect(result.x).toBe(3);
      expect(result.y).toBe(4);
    });

    it("multiply by scalar", () => {
      const v = new Vector2(2, 3);
      const result = v.multiply(2);
      expect(result.x).toBe(4);
      expect(result.y).toBe(6);
    });

    it("divide by scalar", () => {
      const v = new Vector2(4, 6);
      const result = v.divide(2);
      expect(result.x).toBe(2);
      expect(result.y).toBe(3);
    });
  });

  describe("magnitude and normalization", () => {
    it("magnitude of (3, 4) is 5", () => {
      const v = new Vector2(3, 4);
      expect(v.magnitude()).toBeCloseTo(5);
    });

    it("normalize produces unit vector", () => {
      const v = new Vector2(3, 4);
      const n = v.normalize();
      expect(n.magnitude()).toBeCloseTo(1);
    });

    it("normalize of zero vector returns zero", () => {
      const v = Vector2.zero();
      const n = v.normalize();
      expect(n.x).toBe(0);
      expect(n.y).toBe(0);
    });
  });

  describe("distanceTo", () => {
    it("distance between (0,0) and (3,4) is 5", () => {
      const a = Vector2.zero();
      const b = new Vector2(3, 4);
      expect(a.distanceTo(b)).toBeCloseTo(5);
    });

    it("distance is symmetric", () => {
      const a = new Vector2(1, 2);
      const b = new Vector2(4, 6);
      expect(a.distanceTo(b)).toBeCloseTo(b.distanceTo(a));
    });
  });

  describe("dot product", () => {
    it("dot of perpendicular vectors is 0", () => {
      const a = new Vector2(1, 0);
      const b = new Vector2(0, 1);
      expect(a.dot(b)).toBe(0);
    });

    it("dot of parallel vectors equals product of magnitudes", () => {
      const a = new Vector2(2, 0);
      const b = new Vector2(3, 0);
      expect(a.dot(b)).toBe(6);
    });
  });

  describe("rotate", () => {
    it("rotating (1,0) by 90 degrees gives (0,1)", () => {
      const v = new Vector2(1, 0);
      const rotated = v.rotate(Math.PI / 2);
      expect(rotated.x).toBeCloseTo(0);
      expect(rotated.y).toBeCloseTo(1);
    });
  });

  describe("immutability", () => {
    it("operations return new instances", () => {
      const v = new Vector2(1, 2);
      const result = v.add(new Vector2(3, 4));
      expect(result).not.toBe(v);
      expect(v.x).toBe(1);
      expect(v.y).toBe(2);
    });
  });
});

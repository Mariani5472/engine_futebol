export interface ConfidenceInterval {
  readonly lower: number;
  readonly upper: number;
  readonly confidence: number;
}

export interface EstimateWithConfidence extends ConfidenceInterval {
  readonly estimate: number;
}

export function wilsonInterval(successes: number, samples: number, confidence = 0.95): EstimateWithConfidence {
  validateConfidence(confidence);
  if (!Number.isInteger(samples) || samples <= 0) throw new Error("samples must be a positive integer");
  if (!Number.isInteger(successes) || successes < 0 || successes > samples) {
    throw new Error("successes must be an integer in [0, samples]");
  }
  const estimate = successes / samples;
  const z = inverseStandardNormal(0.5 + confidence / 2);
  const z2 = z * z;
  const denominator = 1 + z2 / samples;
  const center = (estimate + z2 / (2 * samples)) / denominator;
  const margin = z * Math.sqrt((estimate * (1 - estimate) + z2 / (4 * samples)) / samples) / denominator;
  return Object.freeze({ estimate, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin), confidence });
}

export function meanConfidenceInterval(values: readonly number[], confidence = 0.95): EstimateWithConfidence {
  validateConfidence(confidence);
  if (values.length === 0 || values.some(value => !Number.isFinite(value))) {
    throw new Error("values must contain at least one finite number");
  }
  const estimate = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) return Object.freeze({ estimate, lower: estimate, upper: estimate, confidence });
  const variance = values.reduce((sum, value) => sum + (value - estimate) ** 2, 0) / (values.length - 1);
  const z = inverseStandardNormal(0.5 + confidence / 2);
  const margin = z * Math.sqrt(variance / values.length);
  return Object.freeze({ estimate, lower: estimate - margin, upper: estimate + margin, confidence });
}

function validateConfidence(confidence: number): void {
  if (!(confidence > 0 && confidence < 1)) throw new Error("confidence must be in (0, 1)");
}

/** Peter J. Acklam's rational approximation; sufficient for evaluation intervals. */
function inverseStandardNormal(probability: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;
  if (probability < low) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (probability > high) {
    const q = Math.sqrt(-2 * Math.log(1 - probability));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
      / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = probability - 0.5;
  const r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
    / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

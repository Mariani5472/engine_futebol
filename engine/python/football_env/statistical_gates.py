from __future__ import annotations

import math
from typing import Sequence

import numpy as np


def mean_confidence_interval(values: Sequence[float], confidence: float = 0.95) -> dict[str, float | int]:
    if len(values) < 2:
        raise ValueError("at least two samples are required")
    if confidence != 0.95:
        raise ValueError("only the versioned 95% interval is currently supported")
    array = np.asarray(values, dtype=np.float64)
    mean = float(array.mean())
    standard_error = float(array.std(ddof=1) / math.sqrt(array.size))
    margin = 1.96 * standard_error
    return {"confidence": confidence, "samples": int(array.size), "mean": mean,
            "standardError": standard_error, "lower": mean - margin, "upper": mean + margin}


def paired_difference_interval(candidate: Sequence[float], reference: Sequence[float]) -> dict[str, float | int]:
    if len(candidate) != len(reference):
        raise ValueError("paired samples must have equal length")
    return mean_confidence_interval(np.asarray(candidate) - np.asarray(reference))


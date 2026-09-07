"""Distance metrics the AsterixDB fork accepts.

The metric can't be a query parameter -- the fork resolves it at parse
time -- so it's checked against SUPPORTED_METRICS before use.
"""

from __future__ import annotations

import math

# All six map to *distance*, so smaller is always closer -- ascending sort.
SUPPORTED_METRICS: frozenset[str] = frozenset(
    {"COSINE", "DOT", "L2", "EUCLIDEAN", "L2_SQUARED", "EUCLIDEAN_SQUARED"}
)


def normalize_metric(metric: str) -> str:
    # Matches the fork's own alias normalization.
    return (metric or "").strip().upper().replace("-", "_")


def is_supported(metric: str) -> bool:
    return normalize_metric(metric) in SUPPORTED_METRICS


def to_score(dist: float | None, metric: str) -> float | None:
    # Raw distances aren't comparable across metrics; this maps to 0..1.
    if dist is None:
        return None
    m = normalize_metric(metric)
    if m == "COSINE":
        return max(0.0, 1.0 - dist)
    if m == "DOT":
        return 1.0 / (1.0 + math.exp(dist))
    return 1.0 / (1.0 + dist)

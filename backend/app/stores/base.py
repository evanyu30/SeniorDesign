"""The seam between the API and whatever holds the vectors.

Everything above this line talks only to ChunkStore -- nothing knows the
vectors live in AsterixDB specifically.
"""

from __future__ import annotations

from typing import Any, Protocol


class StoreError(RuntimeError):
    """Backing store down or rejected the query -- routes map this to HTTP 503."""


class ChunkStore(Protocol):
    name: str

    def search(self, qvec: list[float], k: int, metric: str) -> list[dict[str, Any]]:
        # Ascending distance, nearest first; unscoreable rows get None and sort last.
        ...

    def count(self) -> int:
        ...

    def dim(self) -> int | None:
        # The one embedding dimension in use, or None if mixed/empty.
        ...

    def ping(self) -> tuple[bool, str | None]:
        # (reachable, detail) -- must never raise.
        ...

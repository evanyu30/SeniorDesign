"""ChunkStore backed by the real AsterixDB fork, over the query service API.

Body keys starting with '$' become named SQL++ parameters -- that's how the
query vector is bound safely, never spliced into the statement text.
"""

from __future__ import annotations

from typing import Any

import httpx

from ..config import settings
from ..metrics import SUPPORTED_METRICS, normalize_metric
from .base import StoreError

# Identifiers can't be bound as parameters, so they get an allowlist instead.
_SAFE_IDENT = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")


def _ident(value: str, what: str) -> str:
    if not value or not set(value) <= _SAFE_IDENT:
        raise StoreError(f"unsafe {what} name: {value!r}")
    return value


class AsterixStore:
    name = "asterix"

    def __init__(self) -> None:
        self.url = settings.ASTERIX_URL
        self.dataverse = _ident(settings.ASTERIX_DATAVERSE, "dataverse")
        self.dataset = _ident(settings.ASTERIX_DATASET, "dataset")
        self._client = httpx.Client(timeout=settings.ASTERIX_TIMEOUT)

    def _query(self, statement: str, **params: Any) -> list[dict[str, Any]]:
        # The only place that makes an HTTP call.
        body: dict[str, Any] = {"statement": statement, "format": "JSON"}
        for key, value in params.items():
            body[f"${key}"] = value

        try:
            resp = self._client.post(self.url, json=body)
        except httpx.HTTPError as exc:
            raise StoreError(f"cannot reach AsterixDB at {self.url}: {exc}") from exc

        try:
            payload = resp.json()
        except ValueError as exc:
            raise StoreError(f"AsterixDB returned non-JSON (HTTP {resp.status_code})") from exc

        # AsterixDB reports SQL++ errors in the body with HTTP 200, not a bad status code.
        if payload.get("errors"):
            first = payload["errors"][0]
            raise StoreError(f"SQL++ error {first.get('code')}: {first.get('msg')}")
        if resp.status_code >= 400:
            raise StoreError(f"AsterixDB HTTP {resp.status_code}")

        return payload.get("results", [])

    def search(self, qvec: list[float], k: int, metric: str) -> list[dict[str, Any]]:
        m = normalize_metric(metric)
        if m not in SUPPORTED_METRICS:
            raise StoreError(f"unsupported metric {metric!r}")

        # WHERE c.dim = $dim filters dimension mismatches before they can score null.
        statement = f"""
            USE {self.dataverse};
            SELECT c.id, c.paper_id, c.title, c.authors, c.year, c.page, c.text,
                   vector_distance(c.embedding, $qvec, "{m}") AS distance
            FROM {self.dataset} c
            WHERE c.dim = $dim
            ORDER BY distance ASC NULLS LAST
            LIMIT {int(k)};
        """
        return self._query(statement, qvec=qvec, dim=len(qvec))

    def count(self) -> int:
        rows = self._query(
            f"USE {self.dataverse}; SELECT VALUE COUNT(*) FROM {self.dataset};"
        )
        return int(rows[0]) if rows else 0

    def dim(self) -> int | None:
        # None if the dataset's dims are mixed or absent, not an error.
        rows = self._query(
            f"USE {self.dataverse}; SELECT DISTINCT VALUE c.dim FROM {self.dataset} c;"
        )
        dims = [r for r in rows if isinstance(r, int)]
        return dims[0] if len(dims) == 1 else None

    def ping(self) -> tuple[bool, str | None]:
        # Cheapest possible round trip; never raises.
        try:
            self._query("SELECT VALUE 1;")
            return True, None
        except StoreError as exc:
            return False, str(exc)

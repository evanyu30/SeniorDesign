"""Picks which ChunkStore to build, based on settings.STORE.

The only place in the codebase that names a concrete store class.
"""

from __future__ import annotations

from ..config import settings
from .base import ChunkStore, StoreError

_store: ChunkStore | None = None


def get_store() -> ChunkStore:
    # Built once and reused -- AsterixStore keeps an HTTP connection pool alive.
    global _store
    if _store is None:
        if settings.STORE == "asterix":
            from .asterix import AsterixStore

            _store = AsterixStore()
        else:
            raise StoreError(
                f"unknown STORE={settings.STORE!r}. "
                "Set STORE=asterix (the only implementation so far)."
            )
    return _store


def reset_store() -> None:
    # Used by tests that change settings.
    global _store
    _store = None


__all__ = ["ChunkStore", "StoreError", "get_store", "reset_store"]

"""The API the Electron app will talk to.

    STORE=asterix uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI

from .config import settings
from .metrics import SUPPORTED_METRICS
from .stores import StoreError, get_store

app = FastAPI(title="Research Retrieval API", version="0.1.0")


@app.get("/health")
def health():
    # Never raises -- a down database is "degraded", not a 500.
    try:
        store = get_store()
    except StoreError as exc:
        return {"status": "degraded", "store": settings.STORE, "detail": str(exc)}

    reachable, detail = store.ping()

    chunks = dim = None
    if reachable:
        try:
            chunks = store.count()
            dim = store.dim()
        except StoreError as exc:
            reachable, detail = False, str(exc)

    return {
        "status": "ok" if reachable else "degraded",
        "store": store.name,
        "store_reachable": reachable,
        "dataverse": settings.ASTERIX_DATAVERSE,
        "dataset": settings.ASTERIX_DATASET,
        "rows": chunks,
        "dim": dim,
        "detail": detail,
    }


@app.get("/metrics")
def metrics():
    # Served from the allowlist so the frontend can't drift out of sync.
    return sorted(SUPPORTED_METRICS)

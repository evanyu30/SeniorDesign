"""The API the Electron app will talk to.

    STORE=asterix uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .config import settings
from .embedding import encode
from .metrics import SUPPORTED_METRICS, is_supported, normalize_metric, to_score
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


class SearchRequest(BaseModel):
    question: str
    k: int | None = None
    metric: str | None = None


@app.post("/search")
def search(req: SearchRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(400, "question is empty")

    # Validated here, not left for the store -- a bad metric is a client
    # mistake (400), not a database outage (503).
    metric = normalize_metric(req.metric or settings.DEFAULT_METRIC)
    if not is_supported(metric):
        raise HTTPException(400, f"unsupported metric {metric!r}")

    k = min(req.k or settings.DEFAULT_K, settings.MAX_K)

    try:
        store = get_store()
        rows = store.search(encode(question), k, metric)
    except StoreError as exc:
        raise HTTPException(503, str(exc)) from exc

    # Raw distances aren't meaningful to a UI on their own; attach a 0..1 score too.
    for row in rows:
        row["score"] = to_score(row.get("distance"), metric)

    return {"metric": metric, "results": rows}

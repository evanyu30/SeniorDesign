"""The API the Electron app will talk to.

    STORE=asterix uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import json
from typing import Any

from anthropic import Anthropic
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .config import settings
from .embedding import encode
from .metrics import SUPPORTED_METRICS, is_supported, normalize_metric, to_score
from .stores import StoreError, get_store

app = FastAPI(title="Research Retrieval API", version="0.1.0")

# None until ANTHROPIC_API_KEY is set -- /chat checks for that before using it.
_anthropic = Anthropic(api_key=settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else None


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


def _retrieve(question: str, k: int | None, metric: str | None) -> tuple[str, list[dict[str, Any]]]:
    # Shared by /search and /chat: validate, embed, query, score.
    question = question.strip()
    if not question:
        raise HTTPException(400, "question is empty")

    metric = normalize_metric(metric or settings.DEFAULT_METRIC)
    if not is_supported(metric):
        raise HTTPException(400, f"unsupported metric {metric!r}")

    k = min(k or settings.DEFAULT_K, settings.MAX_K)

    try:
        store = get_store()
        rows = store.search(encode(question), k, metric)
    except StoreError as exc:
        raise HTTPException(503, str(exc)) from exc

    for row in rows:
        row["score"] = to_score(row.get("distance"), metric)
    return metric, rows


@app.post("/search")
def search(req: SearchRequest):
    metric, rows = _retrieve(req.question, req.k, req.metric)
    return {"metric": metric, "results": rows}


class ChatRequest(BaseModel):
    question: str
    k: int | None = None
    metric: str | None = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _build_prompt(question: str, rows: list[dict[str, Any]]) -> str:
    # Fixed template, not LLM-written -- the LLM only ever answers, never queries.
    context = "\n\n".join(f"[{r.get('title')}] {r.get('text')}" for r in rows) or "(no matching chunks found)"
    return (
        "Answer the question using only the context below. "
        "If the context doesn't contain the answer, say so.\n\n"
        f"Context:\n{context}\n\nQuestion: {question}"
    )


@app.post("/chat")
def chat(req: ChatRequest):
    if _anthropic is None:
        raise HTTPException(503, "ANTHROPIC_API_KEY is not set")

    # Retrieval happens before the stream opens, so a StoreError is still a
    # clean HTTPException instead of a broken half-sent response.
    metric, rows = _retrieve(req.question, req.k, req.metric)
    prompt = _build_prompt(req.question, rows)

    def stream():
        yield _sse("sources", {"metric": metric, "results": rows})
        try:
            with _anthropic.messages.stream(
                model=settings.CHAT_MODEL,
                max_tokens=settings.CHAT_MAX_TOKENS,
                messages=[{"role": "user", "content": prompt}],
            ) as s:
                for text in s.text_stream:
                    yield _sse("token", {"text": text})
        except Exception as exc:
            # Headers are already sent by this point -- report the failure
            # as an SSE event, not an HTTP error code.
            yield _sse("error", {"detail": str(exc)})
        yield _sse("done", {})

    return StreamingResponse(stream(), media_type="text/event-stream")

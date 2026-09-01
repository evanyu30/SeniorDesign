"""Loads chunked paper text into ResearchCorpus.paperChunks.

Run from backend/:  python -m scripts.load_corpus [path-to-chunks.json]
Defaults to data/sample_chunks.json -- placeholder text for testing the
pipeline before real paper chunks exist. Swap in a real JSON file later,
same shape: [{paper_id, title, authors, year, page, text}, ...].
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import httpx

from app.config import settings
from app.embedding import encode_batch

DDL = f"""
CREATE DATAVERSE {settings.ASTERIX_DATAVERSE} IF NOT EXISTS;
USE {settings.ASTERIX_DATAVERSE};
CREATE TYPE ChunkType IF NOT EXISTS AS {{ id: string }};
CREATE DATASET {settings.ASTERIX_DATASET}(ChunkType) IF NOT EXISTS PRIMARY KEY id;
"""


def _post(statement: str) -> dict:
    # Same call shape as AsterixStore._query -- no ChunkStore involved, this
    # script only ever writes, and ChunkStore is read-only on purpose.
    resp = httpx.post(settings.ASTERIX_URL, json={"statement": statement, "format": "JSON"}, timeout=60)
    payload = resp.json()
    if payload.get("errors"):
        raise RuntimeError(payload["errors"][0])
    return payload


def load(path: Path) -> None:
    papers = json.loads(path.read_text())
    vectors = encode_batch([p["text"] for p in papers])
    dim = len(vectors[0])

    chunks = []
    for i, (paper, vector) in enumerate(zip(papers, vectors)):
        chunks.append({
            "id": f"{paper['paper_id']}-{i}",
            "paper_id": paper["paper_id"],
            "title": paper.get("title"),
            "authors": paper.get("authors"),
            "year": paper.get("year"),
            "page": paper.get("page", 1),
            "text": paper["text"],
            "embedding": vector,
            "dim": dim,
        })

    _post(DDL)
    # UPSERT (not INSERT) so re-running the script overwrites by id instead of erroring.
    _post(f"USE {settings.ASTERIX_DATAVERSE}; UPSERT INTO {settings.ASTERIX_DATASET} {json.dumps(chunks)};")
    print(f"loaded {len(chunks)} chunks, dim={dim}")


if __name__ == "__main__":
    default = Path(__file__).parent.parent / "data" / "sample_chunks.json"
    load(Path(sys.argv[1]) if len(sys.argv) > 1 else default)

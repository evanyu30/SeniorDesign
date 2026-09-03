# KNN AsterixDB RAG — Backend

A FastAPI service that answers questions over a paper corpus using retrieval-augmented generation: embed the question, find the nearest chunks in AsterixDB with an exact k-NN vector query, then ask Claude to answer using only those chunks. This is the API half of a two-part senior design project — the Electron frontend (`../frontend`) is a thin client that only ever talks to this service.

## Depends on

- **AsterixDB**, running locally with the vector-distance fork: https://github.com/calvin-dani/asterixdb-schema-knn.git (someone else's part of the project — this backend just assumes it's up on `:19002`).
- **Python 3.11+**
- An **Anthropic API key**, for `/chat`'s answer generation.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

`sentence-transformers` pulls in `torch` — a few hundred MB, a few minutes the first install. The embedding model itself (`all-MiniLM-L6-v2`, 384-dim) downloads on first use, not on install.

```bash
cp .env.example .env
```

Fill in `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Everything else in `app/config.py` has a working default — AsterixDB at `localhost:19002`, dataverse `ResearchCorpus`, dataset `paperChunks`. Override any of it with an environment variable of the same name if needed.

## Running

```bash
uvicorn app.main:app --reload --port 8000
```

## Loading data

The corpus needs to exist before `/search` or `/chat` return anything. Make sure AsterixDB is running, then:

```bash
python -m scripts.load_corpus
```

This creates the `ResearchCorpus`/`paperChunks` dataverse and dataset if they don't exist, embeds `data/sample_chunks.json`, and upserts the result. That file is 5 placeholder chunks for testing the pipeline end to end — swap in real paper chunks later, same shape: `[{paper_id, title, authors, year, page, text}, ...]`.

## Endpoints

| Method | Path       | Purpose                                                         |
| ------ | ---------- | --------------------------------------------------------------- |
| GET    | `/health`  | is AsterixDB reachable, and what's in it (row count, dimension) |
| GET    | `/metrics` | the distance metrics AsterixDB's fork accepts                   |
| POST   | `/search`  | embed a question, return the nearest chunks (no LLM call)       |
| POST   | `/chat`    | `/search`, then stream a Claude answer over Server-Sent Events  |

```bash
curl -X POST localhost:8000/search -H "Content-Type: application/json" \
  -d '{"question": "how does RAG work", "k": 3}'

curl -N -X POST localhost:8000/chat -H "Content-Type: application/json" \
  -d '{"question": "how does RAG work", "k": 3}'
```

`/chat`'s stream sends three kinds of SSE events, in order: one `sources` (the retrieved chunks, before any answer text exists), many `token` (streamed answer text), then one `done`. An `error` event can appear if the LLM call fails partway through.

## Architecture

```
app/
├── main.py           FastAPI routes: /health, /metrics, /search, /chat
├── config.py         settings, read from environment / .env
├── embedding.py       text -> vector, one shared model (encode/encode_batch)
├── metrics.py         the metric allowlist + distance -> 0..1 score
└── stores/
    ├── base.py         ChunkStore protocol -- the read-only interface
    └── asterix.py       AsterixStore -- the only implementation, talks SQL++
scripts/
└── load_corpus.py     one-time/rerunnable write path, bypasses ChunkStore
```

`ChunkStore` only has read methods (`search`, `count`, `dim`, `ping`) — the app never needs to update or delete existing chunks, only look things up. `load_corpus.py` writes data directly over HTTP instead of going through `ChunkStore`, since writing isn't part of that interface's contract.

### Why the metric is checked against an allowlist

AsterixDB's fork resolves `vector_distance(a, b, "METRIC")`'s third argument at parse time, so it can never be bound as a query parameter — it has to be pasted into the SQL++ text. `metrics.SUPPORTED_METRICS` is the allowlist that makes that safe: a metric string is checked against it before it ever reaches the query, in `AsterixStore.search()`.

## Not built yet

- Turning real papers (PDFs) into `data/*.json`-shaped chunks — `load_corpus.py` currently expects that shape already, not a PDF
- Evaluation / benchmarking (recall@k across metrics, latency vs. corpus size)
- A second, text-to-SQL retrieval pipeline for comparison against this one

## Built with

[FastAPI](https://fastapi.tiangolo.com/) · [sentence-transformers](https://www.sbert.net/) · [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-python) · [AsterixDB](https://asterixdb.apache.org/)

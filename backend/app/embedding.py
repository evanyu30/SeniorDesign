"""Turns text into vectors, using one pretrained model.

Used by both the corpus-loading script and /search, so they can never
embed with different models.
"""

from __future__ import annotations

from sentence_transformers import SentenceTransformer

from .config import settings

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    # Built once, on first use, and reused after that.
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.EMBED_MODEL)
    return _model


def dim() -> int:
    # Fixed vector length for this model; used for the $dim guard in search().
    return int(_get_model().get_sentence_embedding_dimension())


def encode(text: str) -> list[float]:
    # One string -> one vector. Used for a single search query.
    vector = _get_model().encode(text, normalize_embeddings=True)
    return [float(x) for x in vector]


def encode_batch(texts: list[str]) -> list[list[float]]:
    # Many strings -> many vectors, batched for speed during corpus loading.
    vectors = _get_model().encode(texts, normalize_embeddings=True)
    return [[float(x) for x in row] for row in vectors]

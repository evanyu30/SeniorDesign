"""Settings, read from environment variables.

Every value has a default that works with no setup.
"""

from __future__ import annotations

import os

from dotenv import load_dotenv

load_dotenv()  # reads a .env file in the current directory, if one exists


def _env(key: str, default: str) -> str:
    return os.environ.get(key, default).strip()


class Settings:
    # Which ChunkStore implementation to build.
    STORE: str = _env("STORE", "asterix")

    # Query service API -- not the browser console (19006).
    ASTERIX_URL: str = _env("ASTERIX_URL", "http://localhost:19002/query/service")
    ASTERIX_DATAVERSE: str = _env("ASTERIX_DATAVERSE", "ResearchCorpus")
    ASTERIX_DATASET: str = _env("ASTERIX_DATASET", "paperChunks")
    ASTERIX_TIMEOUT: float = float(_env("ASTERIX_TIMEOUT", "30"))

    # 384-dim, local, no API key needed.
    EMBED_MODEL: str = _env("EMBED_MODEL", "all-MiniLM-L6-v2")

    # Retrieval defaults, used when a request doesn't specify.
    DEFAULT_K: int = int(_env("DEFAULT_K", "8"))
    MAX_K: int = int(_env("MAX_K", "50"))
    DEFAULT_METRIC: str = _env("DEFAULT_METRIC", "COSINE")

    # /chat's LLM. No default key -- /chat reports 503 until this is set.
    ANTHROPIC_API_KEY: str = _env("ANTHROPIC_API_KEY", "")
    CHAT_MODEL: str = _env("CHAT_MODEL", "claude-sonnet-4-5")
    CHAT_MAX_TOKENS: int = int(_env("CHAT_MAX_TOKENS", "1024"))


settings = Settings()

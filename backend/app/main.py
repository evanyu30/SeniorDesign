from fastapi import FastAPI

app = FastAPI(title="Research Retrieval API", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "store": "none yet", "chunks": 0}

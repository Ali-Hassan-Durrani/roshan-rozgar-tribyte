import os

from fastapi import FastAPI

app = FastAPI(title="Roshan Rozgar AI", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai", "demo_mode": os.getenv("DEMO_MODE", "true") == "true"}

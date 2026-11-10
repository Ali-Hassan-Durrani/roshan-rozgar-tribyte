import hashlib
import os
import secrets

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from .ocr_cnic import read_cnic
from .text import diagnose, extract_profile, moderate, summarize

load_dotenv()

app = FastAPI(title="Roshan Rozgar AI", version="0.2.0")

ELEVEN = "https://api.elevenlabs.io/v1"
_tts_cache: dict[str, bytes] = {}


def internal(x_internal_key: str = Header(default="")):
    """Only the backend may call this service."""
    key = os.getenv("AI_INTERNAL_KEY", "")
    if not key or not secrets.compare_digest(x_internal_key, key):
        raise HTTPException(401, "unauthorized")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai",
        "elevenlabs": bool(os.getenv("ELEVENLABS_API_KEY")),
        "demo_mode": os.getenv("DEMO_MODE", "true") == "true",
    }


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class TranscriptIn(BaseModel):
    transcript: str = Field(min_length=1, max_length=4000)


class TtsIn(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    lang: str = "ur"


class ReviewsIn(BaseModel):
    reviews: list[str] = Field(max_length=50)


class TranslateIn(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    to: str = "en"


@app.post("/ocr/cnic", dependencies=[Depends(internal)])
async def ocr_cnic(front: UploadFile = File(...), back: UploadFile = File(...)):
    f = await front.read()
    b = await back.read()
    if len(f) > 5_000_000 or len(b) > 5_000_000:
        raise HTTPException(413, "too large")
    return read_cnic(f, b)


@app.post("/stt", dependencies=[Depends(internal)])
async def stt(audio: UploadFile = File(...), lang: str = Form(default="")):
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise HTTPException(503, "ELEVENLABS_API_KEY not set")
    data = await audio.read()
    if len(data) > 2_000_000:
        raise HTTPException(413, "too large")
    form = {"model_id": "scribe_v1"}
    if lang:
        form["language_code"] = {"ur": "urd", "en": "eng"}.get(lang.lower(), lang)
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{ELEVEN}/speech-to-text",
            headers={"xi-api-key": key},
            data=form,
            files={"file": ("audio", data, audio.content_type or "audio/webm")},
        )
    if r.status_code != 200:
        raise HTTPException(502, "stt failed")
    j = r.json()
    return {"text": j.get("text", "").strip(), "language": j.get("language_code")}


@app.post("/tts", dependencies=[Depends(internal)])
async def tts(body: TtsIn):
    key = os.getenv("ELEVENLABS_API_KEY")
    if not key:
        raise HTTPException(503, "ELEVENLABS_API_KEY not set")
    voice = os.getenv("ELEVENLABS_VOICE_ID_UR" if body.lang.lower() == "ur" else "ELEVENLABS_VOICE_ID_EN") or os.getenv(
        "ELEVENLABS_VOICE_ID_EN", ""
    )
    model = os.getenv("ELEVENLABS_TTS_MODEL") or "eleven_multilingual_v2"
    ck = hashlib.sha256(f"{voice}:{model}:{body.text}".encode()).hexdigest()
    if ck not in _tts_cache:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{ELEVEN}/text-to-speech/{voice}",
                headers={"xi-api-key": key, "accept": "audio/mpeg"},
                json={"text": body.text, "model_id": model},
            )
        if r.status_code != 200:
            raise HTTPException(502, "tts failed")
        _tts_cache[ck] = r.content
    return Response(_tts_cache[ck], media_type="audio/mpeg")


@app.post("/extract/profile", dependencies=[Depends(internal)])
def extract(body: TranscriptIn):
    return extract_profile(body.transcript)


@app.post("/diagnose", dependencies=[Depends(internal)])
def diag(body: TextIn):
    return diagnose(body.text)


@app.post("/moderate/review", dependencies=[Depends(internal)])
def mod(body: TextIn):
    return moderate(body.text)


@app.post("/summary/reviews", dependencies=[Depends(internal)])
def summary(body: ReviewsIn):
    return summarize(body.reviews)


@app.post("/translate", dependencies=[Depends(internal)])
def translate(body: TranslateIn):
    # No LLM key configured: the UI shows the original + read-aloud instead.
    raise HTTPException(503, "translation needs LLM_API_KEY")



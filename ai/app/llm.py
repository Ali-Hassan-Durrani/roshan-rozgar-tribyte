"""Optional Gemini layer. Every caller has a rule-based fallback when this returns None."""

import json
import logging
import os

import httpx

log = logging.getLogger("llm")
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


async def ask_json(prompt: str, timeout: float = 12) -> dict | None:
    key = os.getenv("LLM_API_KEY")
    if not key:
        return None
    model = os.getenv("LLM_MODEL") or "gemini-3.1-flash-lite"
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0},
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as c:
            r = await c.post(URL.format(model=model), headers={"x-goog-api-key": key}, json=body)
        if r.status_code != 200:
            log.warning("llm status %s", r.status_code)
            return None
        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return json.loads(text)
    except Exception as e:  # noqa: BLE001 — any failure falls back to rules
        log.warning("llm failed: %s", type(e).__name__)
        return None


TRADES = "ELECTRICIAN|PLUMBER|AC_TECHNICIAN|CARPENTER|MECHANIC|PAINTER"
SECTORS = "G-8, G-9, G-10, G-11, F-7, F-8, F-10, F-11, E-11, I-8, I-10, Blue Area, Saddar, Satellite Town, Westridge, Bahria Town, DHA"


def profile_prompt(transcript: str) -> str:
    return f"""Extract a skilled worker's profile from this Urdu / Roman Urdu / English transcript of a voice conversation
in Islamabad/Rawalpindi. The transcript may contain both the assistant's questions and the worker's answers; use the worker's answers.
Return JSON with only the keys you are confident about:
{{"name": string (exactly the name the worker said, transliterated to Latin letters; never invent one),
 "trade": one of {TRADES},
 "experienceYears": integer 0-60,
 "areas": array of 1-5 from [{SECTORS}],
 "baseRate": integer PKR 100-50000,
 "workHours": short string like "9am - 7pm"}}
Urdu numbers like "بارہ" = 12, "آٹھ سو" = 800.
Transcript:
\"\"\"{transcript}\"\"\""""


def diagnose_prompt(text: str) -> str:
    return f"""A household customer in Pakistan describes a problem (English, Roman Urdu or Urdu).
Pick the trade and summarise the likely issue in plain English (max 12 words).
Return JSON {{"trade": one of {TRADES}, "issue": string, "confidence": number 0-1}}.
Problem: \"\"\"{text}\"\"\""""


def translate_prompt(text: str, to: str) -> str:
    lang = "simple Urdu in Urdu script" if to.lower().startswith("ur") else "simple English"
    return f"""Translate this chat message between a customer and a tradesperson into {lang}.
Keep prices and numbers exact. Return JSON {{"text": string}}.
Message: \"\"\"{text}\"\"\""""


def summary_prompt(reviews: list[str]) -> str:
    joined = "\n".join(f"- {r}" for r in reviews[:30])
    return f"""Summarise these customer reviews of a tradesperson in 2 short English sentences, neutral and factual,
and list up to 3 short tags customers praise most. Return JSON {{"summary": string, "tags": [string]}}.
Reviews:
{joined}"""


def moderate_prompt(text: str) -> str:
    return f"""Is this marketplace review (Urdu / Roman Urdu / English) abusive, hateful, contains personal contact details or is spam?
Return JSON {{"flagged": boolean, "reason": short string or null}}.
Review: \"\"\"{text}\"\"\""""

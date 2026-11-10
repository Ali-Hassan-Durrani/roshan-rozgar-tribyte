"""Keyword/rule-based AI that works without any LLM key."""

import re
from collections import Counter

TRADE_WORDS = {
    "AC_TECHNICIAN": ["ac technician", "ac", "a/c", "air condition", "thanda", "cooling", "gas", "split", "inverter", "اے سی", "ٹھنڈ", "گیس"],
    "PLUMBER": ["plumber", "nalka", "nal", "leak", "paani", "pani", "pipe", "tap", "drain", "flush", "geyser", "tanki", "water", "نلکا", "پانی", "پائپ", "لیک", "پلمبر"],
    "ELECTRICIAN": ["electrician", "bijli", "switch", "pankha", "fan", "wire", "light", "socket", "breaker", "ups", "short", "chingari", "بجلی", "پنکھا", "سوئچ", "تار", "الیکٹریشن"],
    "CARPENTER": ["carpenter", "door", "darwaza", "lakri", "wood", "cupboard", "almari", "furniture", "table", "hinge", "دروازہ", "لکڑی", "الماری", "بڑھئی", "کارپینٹر"],
    "MECHANIC": ["mechanic", "car", "gaari", "gari", "bike", "engine", "motor", "tyre", "battery", "گاڑی", "انجن", "موٹر", "مکینک"],
    "PAINTER": ["painter", "paint", "rang", "color", "colour", "wall", "deewar", "diwar", "رنگ", "دیوار", "پینٹ", "پینٹر"],
}

URDU_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
NUMBER_WORDS = {
    "ایک": 1, "دو": 2, "تین": 3, "چار": 4, "پانچ": 5, "چھ": 6, "سات": 7, "آٹھ": 8, "نو": 9, "دس": 10,
    "گیارہ": 11, "بارہ": 12, "تیرہ": 13, "چودہ": 14, "پندرہ": 15, "سولہ": 16, "سترہ": 17, "اٹھارہ": 18, "انیس": 19, "بیس": 20,
    "پچیس": 25, "تیس": 30, "ek": 1, "do": 2, "teen": 3, "char": 4, "paanch": 5, "panch": 5, "chay": 6, "saat": 7,
    "aath": 8, "nau": 9, "das": 10, "gyarah": 11, "barah": 12, "baara": 12, "pandrah": 15, "bees": 20,
    "سو": 100, "ہزار": 1000, "sau": 100, "hazar": 1000, "hazaar": 1000,
}
SECTORS = ["G-8", "G-9", "G-10", "G-11", "F-7", "F-8", "F-10", "F-11", "E-11", "I-8", "I-10", "Blue Area", "Saddar",
           "Satellite Town", "Westridge", "Bahria Town", "DHA"]
BAD = ["ullu", "pattha", "kutta", "kamina", "harami", "bewakoof", "gadha", "idiot", "stupid", "fraud", "chor", "الو", "کتا", "کمینہ", "حرامی", "چور", "بےوقوف"]


def _trade(text: str):
    t = text.lower()
    scores = {k: sum(w in t for w in words) for k, words in TRADE_WORDS.items()}
    best = max(scores, key=scores.get)
    return best, scores[best]


def diagnose(text: str):
    trade, hits = _trade(text)
    conf = min(0.55 + hits * 0.15, 0.95) if hits else 0.3
    return {"trade": trade, "issue": text[:120], "confidence": round(conf, 2)}


def _numbers(text: str) -> list[int]:
    t = text.translate(URDU_DIGITS)
    nums = [int(n) for n in re.findall(r"\d+", t)]
    words = re.findall(r"[\w؀-ۿ]+", t.lower())
    for i, w in enumerate(words):
        if w in NUMBER_WORDS and NUMBER_WORDS[w] < 100:
            n = NUMBER_WORDS[w]
            nxt = words[i + 1] if i + 1 < len(words) else ""
            if nxt in ("سو", "sau"):
                n *= 100
            elif nxt in ("ہزار", "hazar", "hazaar"):
                n *= 1000
            nums.append(n)
    return nums


def extract_profile(transcript: str):
    t = transcript
    out: dict = {}
    trade, hits = _trade(t)
    if hits:
        out["trade"] = trade
    m = re.search(r"(?:mera naam|my name is|میرا نام|i am|main)\s*(?:hai|ہے|is)?\s*[:\-]?\s*([A-Za-z؀-ۿ]+(?:\s+[A-Za-z؀-ۿ]+)?)", t, re.I)
    if m:
        name = re.sub(r"\s+(hai|ہے|aur|اور)$", "", m.group(1).strip(), flags=re.I)
        out["name"] = name[:60]
    # Sector names like G-11 are not numbers the worker meant.
    nums = _numbers(re.sub(r"\b[A-Z]-\d{1,2}\b", " ", t, flags=re.I))
    years = [n for n in nums if 0 < n <= 60]
    rates = [n for n in nums if 100 <= n <= 50000]
    if years:
        out["experienceYears"] = years[0]
    if rates:
        out["baseRate"] = rates[0]
    areas = [s for s in SECTORS if re.search(re.escape(s).replace("\\-", "[\\s\\-]?"), t, re.I)]
    if areas:
        out["areas"] = areas[:5]
    hm = re.search(r"(\d{1,2})\s*(?:am|baje|بجے).{0,20}?(\d{1,2})\s*(?:pm|baje|بجے)", t.translate(URDU_DIGITS), re.I)
    if hm:
        out["workHours"] = f"{hm.group(1)}am - {hm.group(2)}pm"
    return out


def moderate(text: str):
    t = text.lower()
    hits = [w for w in BAD if w in t]
    if hits:
        return {"flagged": True, "reason": "Abusive language"}
    if re.search(r"(https?://|www\.|\d{10,})", t):
        return {"flagged": True, "reason": "Spam / contact details"}
    if re.search(r"(.)\1{5,}", t) or t.count("!") > 5:
        return {"flagged": True, "reason": "Spam pattern"}
    return {"flagged": False}


TAG_WORDS = {
    "on time": ["time", "waqt", "jaldi", "quick", "fast"],
    "clean work": ["clean", "saaf", "neat"],
    "fair price": ["price", "munasib", "fair", "sasta", "reasonable"],
    "polite": ["polite", "behaviour", "akhlaq", "achay", "good behaviour"],
    "expert": ["expert", "professional", "maahir", "acha kaam", "great"],
}


def summarize(reviews: list[str]):
    text = " ".join(reviews).lower()
    counts = Counter({tag: sum(text.count(w) for w in words) for tag, words in TAG_WORDS.items()})
    top = [t for t, c in counts.most_common(3) if c]
    if not top:
        return {"summary": "Customers are generally happy with the work.", "tags": []}
    return {
        "summary": f"Customers most often praise: {', '.join(top)}. Based on {len(reviews)} recent reviews.",
        "tags": top,
    }

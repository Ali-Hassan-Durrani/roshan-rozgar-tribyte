"""CNIC OCR: OpenCV preprocessing + Tesseract. Never logs the values it reads."""

import os
import re

import cv2
import numpy as np
import pytesseract

if os.getenv("TESSERACT_CMD"):
    pytesseract.pytesseract.tesseract_cmd = os.getenv("TESSERACT_CMD")
elif os.name == "nt" and os.path.exists(r"C:\Program Files\Tesseract-OCR\tesseract.exe"):
    pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

CNIC_RE = re.compile(r"(\d{5})\s*[-–]?\s*(\d{7})\s*[-–]?\s*(\d)")
DATE_RE = re.compile(r"(\d{2})[.\-/](\d{2})[.\-/](\d{4})")


def _decode(data: bytes):
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("not an image")
    return img


TARGET_WIDTH = 1800  # normalise phone photos (4000px) and small scans alike; keeps OCR ~2-4 s


def _variants(img):
    """Grayscale first (fast, works on most photos), then stronger clean-ups for patterned or uneven cards."""
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    scale = TARGET_WIDTH / g.shape[1]
    g = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
    yield g
    yield cv2.threshold(cv2.GaussianBlur(g, (3, 3), 0), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    yield cv2.adaptiveThreshold(cv2.bilateralFilter(g, 9, 75, 75), 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 11)


def _ocr(img):
    """Best of up to 3 passes: stops at the first one that finds a CNIC number."""
    best = ("", 0.0, [])
    for prepped in _variants(img):
        text, conf, words = _ocr_pass(prepped)
        if _cnic(text):
            return text, conf, words
        if conf > best[1]:
            best = (text, conf, words)
    return best


def _ocr_pass(prepped):
    """One Tesseract pass: words + confidences, with lines rebuilt from Tesseract's layout numbers."""
    data = pytesseract.image_to_data(prepped, lang="eng", output_type=pytesseract.Output.DICT)
    lines: dict[tuple, list[str]] = {}
    confs = []
    for i, w in enumerate(data["text"]):
        c = float(data["conf"][i])
        if not w.strip() or c < 0:
            continue
        confs.append(c)
        lines.setdefault((data["block_num"][i], data["par_num"][i], data["line_num"][i]), []).append(w)
    text = "\n".join(" ".join(ws) for ws in lines.values())
    return text, (sum(confs) / len(confs) if confs else 0.0), [w for ws in lines.values() for w in ws]


def _cnic(text: str):
    m = CNIC_RE.search(text.replace("O", "0").replace("o", "0"))
    return f"{m.group(1)}-{m.group(2)}-{m.group(3)}" if m else None


def _after(label: str, lines: list[str]):
    for i, l in enumerate(lines):
        if re.fullmatch(rf"\s*{label}\s*:?\s*", l, re.I) and i + 1 < len(lines):
            return lines[i + 1].strip()
        m = re.match(rf"\s*{label}\s*:?\s*(.+)", l, re.I)
        if m and len(m.group(1).strip()) > 2:
            return m.group(1).strip()
    return None


def read_cnic(front: bytes, back: bytes):
    f_img, b_img = _decode(front), _decode(back)
    blur = float(cv2.Laplacian(cv2.cvtColor(f_img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var())
    f_text, f_conf, _ = _ocr(f_img)
    b_text, _, _ = _ocr(b_img)
    lines = [l for l in f_text.splitlines() if l.strip()]
    dates = sorted(
        (d for d in DATE_RE.findall(f_text)),
        key=lambda d: (int(d[2]), int(d[1]), int(d[0])),
    )
    fmt = lambda d: f"{d[0]}.{d[1]}.{d[2]}"  # noqa: E731
    return {
        "cnicNumber": _cnic(f_text),
        "backCnicNumber": _cnic(b_text),
        "name": _after("Name", lines),
        "fatherName": _after("Father Name", lines) or _after("Husband Name", lines),
        "dob": fmt(dates[0]) if dates else None,
        "expiry": fmt(dates[-1]) if len(dates) > 1 else None,
        "confidence": round(f_conf, 1),
        "blurScore": round(blur, 1),
    }

"""Sensitive field policy — decide which fields must never be auto-filled."""
from __future__ import annotations

import re
from typing import Optional

from .schemas import Field

# ── Keyword patterns (checked against normalised label + help text + name) ────

_SENSITIVE_PATTERNS: list[re.Pattern] = [re.compile(p, re.IGNORECASE) for p in [
    # Academic records
    r"\bgpa\b", r"\bcap\b", r"\bcumulative average\b", r"\bgrade point\b",
    r"\btranscript\b", r"\bacademic record\b", r"\bclass rank\b", r"\bresult\b",
    r"\bmarks\b", r"\bgrade\b",
    # Identity documents
    r"\bnric\b", r"\bfin\b", r"\bpassport\b", r"\bid number\b", r"\bid no\b",
    r"\bidentification number\b", r"\bdate of birth\b", r"\bdob\b", r"\bbirthday\b",
    r"\bage\b",
    # Financial
    r"\bsalary\b", r"\bpay\b", r"\bcompensation\b", r"\bremuneration\b",
    r"\bexpected.*(salary|pay|wage|compensation)\b",
    r"\bcurrent.*(salary|pay|wage|compensation)\b",
    r"\bhourly.*(rate|pay)\b",
    # Work authorisation
    r"\bwork authoris", r"\bwork authoriz", r"\bauthoriz.*work\b", r"\bauthoris.*work\b",
    r"\bvisa\b", r"\bsponsorship\b",
    r"\bcitizenship\b", r"\bpermanent resident\b", r"\bpr status\b",
    r"\beligib.*work\b", r"\bwork.*eligib\b", r"\bright to work\b",
    r"\bopen to.*work\b",
    # Demographics / EEO
    r"\bgender\b", r"\bsex\b", r"\brace\b", r"\bethnicity\b", r"\breligion\b",
    r"\bdisabilit", r"\bveteran\b", r"\bsexual orientation\b", r"\bpronoun\b",
    r"\bdiversity\b", r"\binclusion\b", r"\bdemograph\b",
    # Legal / consent
    r"\bcriminal\b", r"\bbackground check\b", r"\bconviction\b", r"\bfelony\b",
    r"\bdeclaration\b", r"\bdeclare\b", r"\battestation\b", r"\bsignature\b",
    r"\bconsent\b", r"\bagree.*terms\b", r"\bterms.*conditions\b",
    r"\bauthoris.*fill\b", r"\bauthoriz.*fill\b",
    # References
    r"\breference.*name\b", r"\breference.*email\b", r"\breference.*phone\b",
    r"\breferee\b",
]]

# Fields that are ALWAYS ok (override false positives)
_SAFE_OVERRIDES: list[re.Pattern] = [re.compile(p, re.IGNORECASE) for p in [
    r"\bhow did you hear\b",
    r"\bhow did you find\b",
    r"\bwilling to relocate\b",
    r"\bcover letter\b",
    r"\bresume\b",
    r"\bcv\b",
    r"\bportfolio\b",
]]


def is_sensitive(field: Field) -> bool:
    """Return True if this field should be flagged as sensitive (never auto-filled)."""
    texts = _gather_texts(field)

    # Check safe overrides first
    for text in texts:
        if any(p.search(text) for p in _SAFE_OVERRIDES):
            return False

    # Check sensitive patterns
    for text in texts:
        if any(p.search(text) for p in _SENSITIVE_PATTERNS):
            return True

    # Never auto-fill checkboxes labelled as consent/acknowledgement
    if field.kind in ("checkbox", "checkbox_group"):
        combined = " ".join(texts).lower()
        if any(w in combined for w in ("acknowledge", "agree", "consent", "certify", "attest")):
            return True

    return False


def sensitivity_level(field: Field) -> str:
    """Return 'high', 'medium', or 'low'."""
    if is_sensitive(field):
        return "high"
    # Text fields with free-form answers are medium
    if field.kind in ("textarea",):
        return "medium"
    return "low"


def _gather_texts(field: Field) -> list[str]:
    parts = [field.label]
    if field.helpText:
        parts.append(field.helpText)
    if field.name:
        parts.append(field.name)
    if field.ariaLabel:
        parts.append(field.ariaLabel)
    return [p for p in parts if p]

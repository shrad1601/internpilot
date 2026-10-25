"""Load and query the user profile from ~/InternPilot/profile.json."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional

from .config import DATA_DIR
from .schemas import Profile

PROFILE_PATH = DATA_DIR / "profile.json"

_DEFAULT_PROFILE: dict = {
    "personal": {
        "firstName": "", "lastName": "", "preferredName": "",
        "email": "", "schoolEmail": "", "phone": "", "countryCode": "+65",
        "city": "Singapore", "country": "Singapore", "address": "", "postalCode": "",
    },
    "links": {"linkedin": "", "github": "", "portfolio": ""},
    "education": [],
    "experience": [],
    "projects": [],
    "skills": [],
    "availability": {"earliestStart": "", "latestEnd": "", "minWeeks": None, "partTimeOk": None},
    "workAuth": {},
    "fixedAnswers": {
        "howDidYouHear": "Company careers page",
        "willingToRelocate": "No",
    },
    "documents": {"resume": "documents/resume.pdf"},
    "neverFill": ["gpa", "cap", "transcript", "nric", "salary", "salary_expectation", "demographics"],
}


def load() -> Profile:
    if not PROFILE_PATH.exists():
        PROFILE_PATH.write_text(json.dumps(_DEFAULT_PROFILE, indent=2))
    data = json.loads(PROFILE_PATH.read_text())
    return Profile.model_validate(data)


def save(profile: Profile) -> None:
    PROFILE_PATH.write_text(profile.model_dump_json(indent=2))


# ── Normalisation ─────────────────────────────────────────────────────────────

def _norm(text: str) -> str:
    """Lowercase, strip punctuation/noise, collapse whitespace."""
    t = text.lower()
    t = re.sub(r"[*()?\[\]]", "", t)
    for noise in ("optional", "please enter", "your ", "please provide", "required"):
        t = t.replace(noise, "")
    return re.sub(r"\s+", " ", t).strip()


# ── Synonym groups ────────────────────────────────────────────────────────────
# Each tuple: (canonical_key, [label fragments that map to it])
# Match if ANY fragment is a substring of the normalised label.

_SYNONYMS: list[tuple[str, list[str]]] = [
    # Personal
    ("first_name",          ["first name", "given name", "forename", "prénom"]),
    ("last_name",           ["last name", "surname", "family name", "nom de famille"]),
    ("full_name",           ["full name", "legal name", "complete name"]),
    ("preferred_name",      ["preferred name", "goes by", "nickname"]),
    ("email",               ["email", "e-mail", "electronic mail"]),
    ("school_email",        ["school email", "university email", "nus email", "edu email"]),
    ("phone",               ["phone", "mobile", "telephone", "cell", "contact number", "hp number"]),
    ("city",                ["city", "town", "municipality"]),
    ("country",             ["country", "nation"]),
    ("address",             ["address", "street"]),
    ("postal_code",         ["postal", "zip code", "postcode"]),
    # Links
    ("linkedin",            ["linkedin"]),
    ("github",              ["github"]),
    ("portfolio",           ["portfolio", "personal website", "personal site", "website"]),
    # Education
    ("school",              ["school", "university", "college", "institution", "academic institution"]),
    ("degree",              ["degree", "qualification", "award"]),
    ("major",               ["major", "field of study", "course of study", "programme", "program"]),
    ("graduation",          ["graduation", "expected graduation", "expected grad", "expected completion",
                             "end date", "graduate date", "confer"]),
    ("start_date_edu",      ["start date", "enrolment date", "enrollment date", "matriculation"]),
    # Experience
    ("current_company",     ["current company", "current employer", "present employer", "employer",
                             "organization", "organisation", "company name"]),
    ("current_title",       ["current title", "current role", "current position",
                             "job title", "position title", "role title"]),
    # Fixed answers
    ("how_did_you_hear",    ["how did you hear", "how did you find", "how did you learn",
                             "referral source", "source of application"]),
    ("willing_to_relocate", ["willing to relocate", "open to relocation", "relocate"]),
    # Skills
    ("skills",              ["skills", "technologies", "tech stack", "programming languages"]),
]


def lookup(label: str, kind: str, options: Optional[list] = None) -> Optional[str]:
    """
    Given a normalised field label and kind, return the best profile value,
    or None if nothing matches.
    """
    profile = load()
    n = _norm(label)

    # Full-name shortcut: if the field is a single text input labelled "full name",
    # return "First Last". Some sites have one field for the whole name.
    for key, fragments in _SYNONYMS:
        if not any(f in n for f in fragments):
            continue

        if key == "first_name":
            return _nz(profile.personal.firstName)
        if key == "last_name":
            return _nz(profile.personal.lastName)
        if key == "full_name":
            full = f"{profile.personal.firstName} {profile.personal.lastName}".strip()
            return _nz(full)
        if key == "preferred_name":
            return _nz(profile.personal.preferredName or profile.personal.firstName)
        if key == "email":
            return _nz(profile.personal.email)
        if key == "school_email":
            return _nz(profile.personal.schoolEmail or profile.personal.email)
        if key == "phone":
            ph = profile.personal.phone
            if ph and not ph.startswith("+"):
                ph = profile.personal.countryCode + ph.lstrip("0")
            return _nz(ph)
        if key == "city":
            return _nz(profile.personal.city)
        if key == "country":
            # For select/radio, try to match an option
            if options:
                val = _match_option(profile.personal.country, options)
                return val
            return _nz(profile.personal.country)
        if key == "address":
            return _nz(profile.personal.address)
        if key == "postal_code":
            return _nz(profile.personal.postalCode)
        if key == "linkedin":
            return _nz(profile.links.linkedin)
        if key == "github":
            return _nz(profile.links.github)
        if key == "portfolio":
            return _nz(profile.links.portfolio)
        if key == "school":
            edu = profile.education[0] if profile.education else None
            if options and edu:
                return _match_option(edu.school, options) or _nz(edu.school)
            return _nz(edu.school) if edu else None
        if key == "degree":
            edu = profile.education[0] if profile.education else None
            if options and edu:
                return _match_option(edu.degree, options) or _nz(edu.degree)
            return _nz(edu.degree) if edu else None
        if key == "major":
            edu = profile.education[0] if profile.education else None
            return _nz(edu.major) if edu else None
        if key == "graduation":
            edu = profile.education[0] if profile.education else None
            return _nz(edu.expectedGraduation) if edu else None
        if key == "start_date_edu":
            edu = profile.education[0] if profile.education else None
            return _nz(edu.startDate) if edu else None
        if key == "current_company":
            exp = _current_exp(profile)
            return _nz(exp.company) if exp else None
        if key == "current_title":
            exp = _current_exp(profile)
            return _nz(exp.title) if exp else None
        if key == "how_did_you_hear":
            val = profile.fixedAnswers.get("howDidYouHear", "")
            if options:
                return _match_option(val, options) or _nz(val)
            return _nz(val)
        if key == "willing_to_relocate":
            val = profile.fixedAnswers.get("willingToRelocate", "")
            if options:
                return _match_option(val, options) or _nz(val)
            return _nz(val)
        if key == "skills":
            return ", ".join(profile.skills) if profile.skills else None

    return None


def _nz(val: Optional[str]) -> Optional[str]:
    """Return None for empty/whitespace strings."""
    return val.strip() if val and val.strip() else None


def _current_exp(profile: Profile):
    for exp in profile.experience:
        if exp.current:
            return exp
    return profile.experience[0] if profile.experience else None


def _match_option(target: str, options: list) -> Optional[str]:
    """Case-insensitive substring match of target against option labels."""
    if not target:
        return None
    t = target.lower()
    # Exact match first
    for opt in options:
        lbl = (opt.get("label") if isinstance(opt, dict) else opt.label) or ""
        if lbl.lower() == t:
            return lbl
    # Substring match
    for opt in options:
        lbl = (opt.get("label") if isinstance(opt, dict) else opt.label) or ""
        if t in lbl.lower() or lbl.lower() in t:
            return lbl
    return None

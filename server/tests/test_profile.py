import pytest
from pathlib import Path
import internpilot.profile as profile_mod
from internpilot.profile import lookup, save, load


@pytest.fixture(autouse=True)
def isolated_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(profile_mod, "PROFILE_PATH", tmp_path / "profile.json")


def test_load_creates_default():
    profile = load()
    assert profile.personal.firstName == ""


def test_save_and_reload():
    p = load()
    p.personal.firstName = "Alice"
    p.personal.email = "alice@example.com"
    save(p)

    p2 = load()
    assert p2.personal.firstName == "Alice"
    assert p2.personal.email == "alice@example.com"


def test_lookup_first_name():
    p = load()
    p.personal.firstName = "Bob"
    save(p)

    assert lookup("First Name", "text") == "Bob"
    assert lookup("given name", "text") == "Bob"


def test_lookup_last_name():
    p = load()
    p.personal.lastName = "Smith"
    save(p)

    assert lookup("Last Name", "text") == "Smith"
    assert lookup("surname", "text") == "Smith"
    assert lookup("family name", "text") == "Smith"


def test_lookup_email():
    p = load()
    p.personal.email = "bob@test.com"
    save(p)

    assert lookup("Email Address", "email") == "bob@test.com"
    assert lookup("email", "email") == "bob@test.com"


def test_lookup_phone():
    p = load()
    p.personal.phone = "+65 9123 4567"
    save(p)

    assert lookup("Phone Number", "tel") == "+65 9123 4567"
    assert lookup("mobile", "tel") == "+65 9123 4567"


def test_lookup_linkedin():
    p = load()
    p.links.linkedin = "https://linkedin.com/in/bob"
    save(p)

    assert lookup("LinkedIn Profile", "url") == "https://linkedin.com/in/bob"


def test_lookup_unknown_returns_none():
    p = load()
    p.personal.firstName = "Alice"
    save(p)

    assert lookup("favourite color", "text") is None


def test_lookup_select_country():
    p = load()
    p.personal.country = "Singapore"
    save(p)

    options = [
        {"value": "SG", "label": "Singapore"},
        {"value": "US", "label": "United States"},
    ]
    result = lookup("Country", "select", options)
    assert result == "Singapore"


def test_lookup_empty_string_returns_none():
    p = load()
    p.personal.city = ""
    save(p)

    assert lookup("City", "text") is None


def test_lookup_school():
    p = load()
    from internpilot.schemas import EducationEntry
    p.education = [EducationEntry(school="NUS", degree="BComp", major="CS", graduation="2025")]
    save(p)

    assert lookup("University", "text") == "NUS"
    assert lookup("School", "text") == "NUS"

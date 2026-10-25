import pytest
import internpilot.profile as profile_mod
from internpilot.resolver import resolve
from internpilot.schemas import PageSnapshot, Field, FieldOption


@pytest.fixture(autouse=True)
def isolated_profile(tmp_path, monkeypatch):
    monkeypatch.setattr(profile_mod, "PROFILE_PATH", tmp_path / "profile.json")


def _snap(fields: list[Field]) -> PageSnapshot:
    return PageSnapshot(
        url="https://jobs.example.com/apply",
        domain="jobs.example.com",
        title="Apply",
        fields=fields,
        buttons=[],
    )


def _field(**kwargs) -> Field:
    defaults = dict(
        agentId="f1", frameId=0, kind="text", label="First Name",
        labelSources=["label-for"], required=True, visible=True, disabled=False,
    )
    defaults.update(kwargs)
    return Field(**defaults)


def test_password_field_is_skipped():
    f = _field(kind="password", label="Password")
    actions = resolve(_snap([f]))
    assert all(a.action.type == "skip" for a in actions)


def test_invisible_field_is_skipped():
    f = _field(visible=False)
    actions = resolve(_snap([f]))
    assert len(actions) == 0


def test_disabled_field_is_skipped():
    f = _field(disabled=True)
    actions = resolve(_snap([f]))
    assert len(actions) == 0


def test_sensitive_field_becomes_ask_user():
    """Sensitive fields surface as ask_user so user fills them manually."""
    f = _field(label="GPA", kind="text")
    actions = resolve(_snap([f]))
    assert len(actions) == 1
    assert actions[0].action.type == "ask_user"
    assert actions[0].sensitivity == "high"


def test_profile_fill_first_name():
    from internpilot.profile import load, save
    p = load()
    p.personal.firstName = "Alice"
    save(p)

    f = _field(label="First Name", kind="text")
    actions = resolve(_snap([f]))
    assert len(actions) == 1
    a = actions[0]
    assert a.action.type == "fill"
    assert a.action.value == "Alice"  # type: ignore[union-attr]
    assert a.source == "profile"
    assert a.sensitivity == "low"


def test_ask_user_when_no_profile_value():
    f = _field(label="First Name", kind="text")
    actions = resolve(_snap([f]))
    assert len(actions) == 1
    assert actions[0].action.type == "ask_user"


def test_select_field_with_profile_match():
    from internpilot.profile import load, save
    p = load()
    p.personal.country = "Singapore"
    save(p)

    opts = [FieldOption(value="SG", label="Singapore"), FieldOption(value="US", label="United States")]
    f = _field(label="Country", kind="select", options=opts)
    actions = resolve(_snap([f]))
    assert len(actions) == 1
    a = actions[0]
    assert a.action.type == "select"
    assert a.action.optionLabel == "Singapore"  # type: ignore[union-attr]


def test_combobox_skipped():
    f = _field(label="School", kind="combobox")
    actions = resolve(_snap([f]))
    assert len(actions) == 1
    assert actions[0].action.type == "skip"


def test_multiple_fields():
    from internpilot.profile import load, save
    p = load()
    p.personal.firstName = "Bob"
    p.personal.lastName = "Jones"
    save(p)

    fields = [
        _field(agentId="f1", label="First Name", kind="text"),
        _field(agentId="f2", label="Last Name", kind="text"),
        _field(agentId="f3", label="GPA", kind="text"),
    ]
    actions = resolve(_snap(fields))
    assert len(actions) == 3
    types = [a.action.type for a in actions]
    assert types[0] == "fill"
    assert types[1] == "fill"
    assert types[2] == "ask_user"  # GPA is sensitive → ask_user

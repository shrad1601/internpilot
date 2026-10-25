"""Phase 2 resolver: policy → profile only (no LLM/memory yet)."""
from __future__ import annotations

from typing import Optional

from .schemas import (
    Field, PageSnapshot, ProposedAction,
    FillAction, SelectAction, RadioAction, CheckAction,
    SkipAction, AskUserAction,
)
from . import policy, profile as profile_mod


def resolve(snapshot: PageSnapshot) -> list[ProposedAction]:
    """Resolve all visible, enabled fields into ProposedActions."""
    results: list[ProposedAction] = []

    for field in snapshot.fields:
        if not field.visible or field.disabled:
            continue
        if field.kind == "password":
            continue

        proposed = _resolve_field(field)
        results.append(proposed)

    return results


def _resolve_field(field: Field) -> ProposedAction:
    sens = policy.sensitivity_level(field)

    # 1. Policy: sensitive → ask_user
    if sens == "high":
        return ProposedAction(
            action=AskUserAction(
                agentId=field.agentId,
                question=f"What should I enter for '{field.label}'?",
                reason="This field contains sensitive information — you should fill it yourself.",
                suggestions=[],
            ),
            source="profile",
            confidence=0.0,
            sensitivity="high",
            explanation=f"Sensitive field — requires your input",
        )

    # 2. Check profile neverFill list
    profile = profile_mod.load()
    label_lower = field.label.lower()
    if any(nf.lower() in label_lower for nf in profile.neverFill):
        return ProposedAction(
            action=SkipAction(
                agentId=field.agentId,
                reason=f"'{field.label}' is in your never-fill list",
            ),
            source="profile",
            confidence=1.0,
            sensitivity=sens,
            explanation="Listed in your never-fill preferences",
        )

    # 3. Skip file uploads for now (Phase 3 will handle resume upload)
    if field.kind == "file":
        return ProposedAction(
            action=SkipAction(
                agentId=field.agentId,
                reason="File upload — attach manually",
            ),
            source="profile",
            confidence=1.0,
            sensitivity=sens,
            explanation="File upload — you'll need to attach this yourself",
        )

    # 4. Skip combobox (lazy options — Phase 3)
    if field.kind == "combobox":
        return ProposedAction(
            action=SkipAction(
                agentId=field.agentId,
                reason="Custom dropdown — Phase 3 will handle these",
            ),
            source="profile",
            confidence=0.0,
            sensitivity=sens,
            explanation="Custom dropdown — skipped until Phase 3",
        )

    # 5. Profile lookup
    opts = [{"label": o.label, "value": o.value} for o in (field.options or [])]
    value = profile_mod.lookup(field.label, field.kind, opts or None)

    if value:
        action = _make_fill_action(field, value)
        return ProposedAction(
            action=action,
            source="profile",
            confidence=0.95,
            sensitivity=sens,
            explanation=f"From your profile",
        )

    # 6. No match → ask user
    suggestions = _suggest(field)
    return ProposedAction(
        action=AskUserAction(
            agentId=field.agentId,
            question=f"What should I enter for '{field.label}'?",
            reason="Not found in your profile",
            suggestions=suggestions,
        ),
        source="profile",
        confidence=0.0,
        sensitivity=sens,
        explanation="Not in profile — needs your answer",
    )


def _make_fill_action(field: Field, value: str):
    """Return the right action type based on field kind."""
    kind = field.kind

    if kind == "select":
        opt_label = _match_option_label(value, field.options or [])
        return SelectAction(agentId=field.agentId, optionLabel=opt_label or value)

    if kind == "radio_group":
        opt_label = _match_option_label(value, field.options or [])
        return RadioAction(agentId=field.agentId, optionLabel=opt_label or value)

    if kind in ("checkbox", "checkbox_group"):
        # For a single checkbox: value should be "true"/"false" or "yes"/"no"
        checked = value.lower() in ("true", "yes", "1", "on")
        return CheckAction(agentId=field.agentId, checked=checked)

    return FillAction(agentId=field.agentId, value=value)


def _match_option_label(value: str, options) -> Optional[str]:
    """Case-insensitive match of value against option labels."""
    v = value.lower()
    for opt in options:
        lbl = opt.label if hasattr(opt, "label") else opt.get("label", "")
        if lbl.lower() == v:
            return lbl
    for opt in options:
        lbl = opt.label if hasattr(opt, "label") else opt.get("label", "")
        if v in lbl.lower() or lbl.lower() in v:
            return lbl
    return None


def _suggest(field: Field) -> list[str]:
    """Offer option labels as suggestions for select/radio fields."""
    if field.options:
        return [o.label for o in field.options[:4]]
    return []

from __future__ import annotations

from typing import Annotated, Any, Literal, Optional, Union
from pydantic import BaseModel, Field as PydanticField


# ── Pairing / health ──────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str


class PairRequest(BaseModel):
    code: str


class PairResponse(BaseModel):
    token: str


# ── Field ─────────────────────────────────────────────────────────────────────

FieldKind = Literal[
    "text", "email", "tel", "url", "number", "date", "textarea",
    "select", "combobox", "radio_group", "checkbox", "checkbox_group",
    "file", "password", "unknown",
]

ATSKind = Literal[
    "greenhouse", "lever", "workday", "successfactors",
    "taleo", "icims", "ashby", "other",
]


class FieldOption(BaseModel):
    value: str
    label: str


class Field(BaseModel):
    agentId: str
    frameId: int = 0
    kind: FieldKind
    label: str
    labelSources: list[str] = []
    name: Optional[str] = None
    id: Optional[str] = None
    placeholder: Optional[str] = None
    ariaLabel: Optional[str] = None
    helpText: Optional[str] = None
    sectionHeading: Optional[str] = None
    required: bool = False
    currentValue: Optional[Union[str, list[str]]] = None
    options: Optional[list[FieldOption]] = None
    maxLength: Optional[int] = None
    accept: Optional[str] = None
    visible: bool = True
    disabled: bool = False


class PageButton(BaseModel):
    agentId: str
    text: str
    role: Literal["next", "back", "submit", "save", "other"]


class PageSnapshot(BaseModel):
    url: str
    domain: str = ""
    title: str = ""
    atsGuess: Optional[ATSKind] = None
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    jobDescription: Optional[str] = None
    fields: list[Field] = []
    buttons: list[PageButton] = []
    stepIndicator: Optional[str] = None


# ── Actions ───────────────────────────────────────────────────────────────────

class FillAction(BaseModel):
    type: Literal["fill"] = "fill"
    agentId: str
    value: str


class SelectAction(BaseModel):
    type: Literal["select"] = "select"
    agentId: str
    optionLabel: str


class CheckAction(BaseModel):
    type: Literal["check"] = "check"
    agentId: str
    checked: bool


class RadioAction(BaseModel):
    type: Literal["choose_radio"] = "choose_radio"
    agentId: str
    optionLabel: str


class UploadAction(BaseModel):
    type: Literal["upload"] = "upload"
    agentId: str
    documentKey: str


class ClickAction(BaseModel):
    type: Literal["click"] = "click"
    agentId: str
    purpose: Literal["next", "add_entry", "expand"]


class AskUserAction(BaseModel):
    type: Literal["ask_user"] = "ask_user"
    agentId: str
    question: str
    reason: str
    suggestions: list[str] = []


class SkipAction(BaseModel):
    type: Literal["skip"] = "skip"
    agentId: str
    reason: str


Action = Annotated[
    Union[
        FillAction, SelectAction, CheckAction, RadioAction,
        UploadAction, ClickAction, AskUserAction, SkipAction,
    ],
    PydanticField(discriminator="type"),
]


class ProposedAction(BaseModel):
    action: Action
    source: Literal["rule", "memory", "profile", "llm", "research", "user"]
    confidence: float = PydanticField(ge=0.0, le=1.0)
    sensitivity: Literal["low", "medium", "high"]
    explanation: str
    memoryRefs: list[str] = []


# ── Run management ────────────────────────────────────────────────────────────

class RunCreate(BaseModel):
    tabId: int
    url: str
    title: str = ""
    company: Optional[str] = None
    jobTitle: Optional[str] = None


class RunResponse(BaseModel):
    runId: str


class PlanRequest(BaseModel):
    snapshot: PageSnapshot


class PlanResponse(BaseModel):
    runId: str
    actions: list[ProposedAction]


# ── Step log ──────────────────────────────────────────────────────────────────

StepKind = Literal[
    "read_page", "propose", "approve", "edit", "skip",
    "fill", "click", "ask", "answer", "navigate",
    "error", "stop", "feedback",
]

StepStatus = Literal["ok", "waiting", "skipped", "failed"]


class StepEntry(BaseModel):
    runId: str
    seq: int
    ts: str
    kind: StepKind
    status: StepStatus = "ok"
    fieldLabel: Optional[str] = None
    agentId: Optional[str] = None
    value: Optional[str] = None
    source: Optional[str] = None
    confidence: Optional[float] = None
    message: str
    durationMs: Optional[int] = None


class RunFinish(BaseModel):
    status: Literal["completed", "stopped", "error", "ready_for_submit"]


# ── Profile ───────────────────────────────────────────────────────────────────

class PersonalProfile(BaseModel):
    firstName: str = ""
    lastName: str = ""
    preferredName: str = ""
    email: str = ""
    schoolEmail: str = ""
    phone: str = ""
    countryCode: str = "+65"
    city: str = ""
    country: str = ""
    address: str = ""
    postalCode: str = ""


class LinksProfile(BaseModel):
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""


class EducationEntry(BaseModel):
    school: str = ""
    degree: str = ""
    major: str = ""
    startDate: str = ""
    expectedGraduation: str = ""
    currentYear: Optional[int] = None


class ExperienceEntry(BaseModel):
    company: str = ""
    title: str = ""
    start: str = ""
    end: str = ""
    current: bool = False
    bullets: list[str] = []


class AvailabilityProfile(BaseModel):
    earliestStart: str = ""
    latestEnd: str = ""
    minWeeks: Optional[int] = None
    partTimeOk: Optional[bool] = None


class Profile(BaseModel):
    personal: PersonalProfile = PersonalProfile()
    links: LinksProfile = LinksProfile()
    education: list[EducationEntry] = []
    experience: list[ExperienceEntry] = []
    projects: list[Any] = []
    skills: list[str] = []
    availability: AvailabilityProfile = AvailabilityProfile()
    workAuth: dict[str, Any] = {}
    fixedAnswers: dict[str, str] = {}
    documents: dict[str, str] = {}
    neverFill: list[str] = []

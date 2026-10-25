from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str


class PairRequest(BaseModel):
    code: str


class PairResponse(BaseModel):
    token: str

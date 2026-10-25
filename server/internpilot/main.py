import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware

from . import auth
from .schemas import HealthResponse, PairRequest, PairResponse

logger = logging.getLogger(__name__)

VERSION = "0.1.0"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    code = auth.init_pairing()
    print(f"\n{'='*44}")
    print(f"  InternPilot {VERSION} — server started")
    print(f"  Pairing code : {code}")
    print(f"  Code expires in 5 minutes")
    print(f"  Listening on  127.0.0.1:8765")
    print(f"{'='*44}\n")
    yield


app = FastAPI(title="InternPilot", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_token(x_ip_token: Optional[str] = Header(default=None)) -> str:
    if not x_ip_token or not auth.verify_token(x_ip_token):
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    return x_ip_token


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version=VERSION)


@app.post("/pair", response_model=PairResponse)
async def pair(req: PairRequest):
    token = auth.pair_with_code(req.code)
    if token is None:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    return PairResponse(token=token)


# Entry point for `python -m internpilot`
if __name__ == "__main__":  # pragma: no cover
    import uvicorn
    from .config import HOST, PORT
    uvicorn.run("internpilot.main:app", host=HOST, port=PORT, reload=True)

import uvicorn
from .config import HOST, PORT

uvicorn.run("internpilot.main:app", host=HOST, port=PORT, reload=True)

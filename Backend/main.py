from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from Backend.controller.SQLrouter import SQLRouter 
from Backend.controller.DatabaseRouter import DatabaseRouter
from Backend.database.sqlite import init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(title="SQLWhisper API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
app.include_router(SQLRouter)
app.include_router(DatabaseRouter)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}

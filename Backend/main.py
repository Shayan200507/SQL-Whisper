from contextlib import asynccontextmanager

from fastapi import FastAPI

from Backend.controller.SQLrouter import SQLRouter 
from Backend.controller.DatabaseRouter import DatabaseRouter
from Backend.database.sqlite import init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


app = FastAPI(title="SQLWhisper API", version="0.1.0", lifespan=lifespan)
app.include_router(SQLRouter)
app.include_router(DatabaseRouter)


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok"}

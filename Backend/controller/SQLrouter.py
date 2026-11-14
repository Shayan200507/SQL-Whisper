

from contextlib import closing
from pathlib import Path as FilePath
import sqlite3

import psycopg
from fastapi import APIRouter, HTTPException, Path, status
from pydantic import BaseModel, Field, ValidationError

from Backend.controller.DatabaseRouter import DatabaseConnection, connect_database, get_schema
from Backend.database.sqlite import DATABASE_PATH

import os
import math

import torch
from torch.utils.data import DataLoader

from datasets import load_dataset

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    default_data_collator
)

from peft import PeftModel

ADAPTER_PATH = (
    FilePath(__file__).resolve().parents[1]
    / "models" / "qwen-lora-tuned-sql"
)

model_name = "Qwen/Qwen2.5-Coder-1.5B-Instruct"
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True, ##quantizaiton in 4 btis
    bnb_4bit_quant_type="nf4",## ahndels rpecisison there ar 16 possible numebrs in 4 btis sicne bits are clsoer to 0 nf4 keeps the 16 valeus clsoes to 0
    bnb_4bit_compute_dtype=torch.bfloat16 ## 16 computations bits
    
)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    quantization_config = bnb_config,
    device_map = "auto",
    trust_remote_code = True
).eval()


tokenizer = AutoTokenizer.from_pretrained(
    str(ADAPTER_PATH)
)

tuned_model = PeftModel.from_pretrained(
    
    model,
    str(ADAPTER_PATH)
    
).eval()




def generate_sql(model, instruction):
    model.eval()

    prompt = f"Instruction: {instruction}\nResponse:"

    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=1024
    ).to(model.device)

    with torch.inference_mode():
        outputs = model.generate(
            **inputs,
            max_new_tokens=256,
            do_sample=False,
            pad_token_id=tokenizer.pad_token_id
        )

    # Extract only newly generated tokens
    generated_tokens = outputs[0][inputs["input_ids"].shape[1]:]

    response = tokenizer.decode(
        generated_tokens,
        skip_special_tokens=True
    )

    return response.strip()






SQLRouter = APIRouter(prefix="/sql", tags=["SQL"])


class PromptRequest(BaseModel):
    prompt: str = Field(min_length=1, pattern=r"\S")


def get_database_config(database_id: int) -> DatabaseConnection:
    try:
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            connection.row_factory = sqlite3.Row
            row = connection.execute(
                """
                SELECT host, port, dbname, username, password, sslmode
                FROM database_credentials WHERE id = ?
                """,
                (database_id,),
            ).fetchone()
    except sqlite3.Error:
        raise HTTPException(status_code=500, detail="Could not read database credentials") from None

    if row is None:
        raise HTTPException(status_code=404, detail="Database connection not found")

    try:
        return DatabaseConnection(**dict(row))
    except ValidationError:
        raise HTTPException(status_code=500, detail="Stored database configuration is invalid") from None

def get_schema_by_database_id(database_id: int):
    config = get_database_config(database_id)
    try:
        return get_schema(config)
    except psycopg.Error:
        raise HTTPException(status_code=502, detail="Could not fetch database schema") from None


def generate_response(prompt: str, schema: str) -> str:
    instruction = (
        "Translate this question into ONE read-only PostgreSQL 14+ "
        "SELECT query. Use only the schema below. Return SQL only; no markdown "
        "or explanation.\n\n"
        f"Database schema:\n{schema}\n\n"
        f"Question: {prompt}"
    )
    
    return generate_sql(tuned_model, instruction)


@SQLRouter.post("/prompt/{database_id}")
def prompt_database(request: PromptRequest, database_id: int = Path(gt=0)):
    config = get_database_config(database_id)
    try:
        schema = get_schema(config)
    except psycopg.Error:
        raise HTTPException(status_code=502, detail="Could not fetch database schema") from None
    response = generate_response(request.prompt, schema)
    print(response)
    try:
        with connect_database(config) as conn:
            conn.read_only = True
            with conn.cursor() as cursor:
                cursor.execute("SET LOCAL statement_timeout = '30s'")
                # Preparing the generated query rejects multiple SQL statements.
                cursor.execute(response, prepare=True)
                if cursor.description is None:
                    raise HTTPException(status_code=422, detail="Generated SQL did not return rows")
                columns = [column.name for column in cursor.description]
                rows = cursor.fetchall()
    except psycopg.Error:
        raise HTTPException(status_code=502, detail="Could not execute generated SQL") from None
    return {
        "columns": columns,
        "rows": rows,
    }




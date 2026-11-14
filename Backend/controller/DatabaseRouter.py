from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
import psycopg
import sqlite3
from contextlib import closing

from Backend.database.sqlite import DATABASE_PATH


DatabaseRouter = APIRouter(prefix="/database", tags=["database"])


from typing import Literal

class DatabaseConnection(BaseModel):
    host: str = "localhost"
    port: int = Field(default=5432, ge=1, le=65535)
    dbname: str = Field(min_length=1)
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    sslmode: Literal["disable", "require", "prefer", "verify-ca", "verify-full"] = "prefer"


class DatabaseEntryCreate(DatabaseConnection):
    pass




class DatabaseEntryCreated(BaseModel):
    id: int


@DatabaseRouter.get("/getEntries")
def getEntries():

    try:
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
             

                cursor = connection.execute("""

                    SELECT id,host,port,dbname,username,created_at FROM database_credentials;


                """
                )

                columns = [column[0] for column in cursor.description]
                rows = cursor.fetchall()

                return [dict(zip(columns, row)) for row in rows]



    except sqlite3.Error:
         raise HTTPException(
                    status_code=500, detail="Could not save database credentials")
    
                






@DatabaseRouter.post(
    "/creatingEntry",
    response_model=DatabaseEntryCreated,
    status_code=status.HTTP_201_CREATED,
)
def creatingEntry(config: DatabaseEntryCreate):
    try:
        with closing(sqlite3.connect(DATABASE_PATH)) as connection:
            with connection:
                cursor = connection.execute(
                    """
                    INSERT INTO database_credentials
                        (user_id, host, port, dbname, username, password, sslmode)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        "local", config.host, config.port, config.dbname,
                        config.username, config.password, config.sslmode,
                    ),
                )
                entry_id = cursor.lastrowid
    except sqlite3.Error:
        raise HTTPException(
            status_code=500, detail="Could not save database credentials"
        ) from None
    return {"id": entry_id}


def connect_database(config:DatabaseConnection):
    try:
        return psycopg.connect(
        host=config.host,
        port=config.port,
        dbname=config.dbname,
        user=config.username,
        password=config.password,
        sslmode=config.sslmode,
        connect_timeout=5
    )
    except psycopg.OperationalError as e:
        print("Connection error:", repr(e), flush=True)
        raise

    

    



def get_schema(config: DatabaseConnection) -> str:
    """Return public tables as CREATE TABLE text for the model's schema prompt.

    Constraints stay at table level so composite keys retain their meaning.
    This describes the schema for inference; it is not a database backup.
    """
    with connect_database(config) as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT
                    c.oid,
                    pg_catalog.quote_ident(c.relname),
                    pg_catalog.quote_ident(a.attname),
                    pg_catalog.format_type(a.atttypid, a.atttypmod),
                    a.attnotnull
                FROM pg_catalog.pg_class c
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
                WHERE n.nspname = 'public'
                  AND c.relkind IN ('r', 'p')
                  AND a.attnum > 0
                  AND NOT a.attisdropped
                ORDER BY c.relname, a.attnum
            """)
            columns = cursor.fetchall()

            cursor.execute("""
                SELECT
                    con.conrelid,
                    pg_catalog.pg_get_constraintdef(con.oid)
                FROM pg_catalog.pg_constraint con
                JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relkind IN ('r', 'p')
                  AND con.contype IN ('p', 'f', 'u', 'c')
                ORDER BY c.relname,
                    CASE con.contype
                        WHEN 'p' THEN 0 WHEN 'f' THEN 1
                        WHEN 'u' THEN 2 ELSE 3
                    END,
                    con.conname
            """)
            constraints = cursor.fetchall()

    tables = {}
    for table_id, table_name, column_name, data_type, not_null in columns:
        table = tables.setdefault(table_id, {"name": table_name, "parts": []})
        definition = f"{column_name} {data_type}"
        if not_null:
            definition += " NOT NULL"
        table["parts"].append(definition)

    for table_id, definition in constraints:
        if table_id in tables:
            tables[table_id]["parts"].append(definition)

    print("we got the schema")        

    return "\n".join(
        f"CREATE TABLE {table['name']} ({', '.join(table['parts'])});"
        for table in tables.values()
    )

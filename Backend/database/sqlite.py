"""Initialize the local database using Python's built-in sqlite3 module."""

import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).resolve().parent / "credentials.db"


def init_database(db_path: str | Path = DATABASE_PATH) -> None:
    connection = sqlite3.connect(db_path)
    try:
        with connection:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS database_credentials (
                    id INTEGER PRIMARY KEY,
                    user_id TEXT NOT NULL CHECK (length(trim(user_id)) > 0),
                    host TEXT NOT NULL,
                    port INTEGER NOT NULL DEFAULT 5432
                        CHECK (port BETWEEN 1 AND 65535),
                    dbname TEXT NOT NULL,
                    username TEXT NOT NULL,
                    password TEXT NOT NULL,
                    sslmode TEXT NOT NULL DEFAULT 'prefer'
                        CHECK (sslmode IN (
                            'disable', 'allow', 'prefer', 'require',
                            'verify-ca', 'verify-full'
                        )),
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
            """)
            connection.execute("""
                CREATE INDEX IF NOT EXISTS idx_database_credentials_user_id
                ON database_credentials (user_id)
            """)
    finally:
        connection.close()


if __name__ == "__main__":
    init_database()

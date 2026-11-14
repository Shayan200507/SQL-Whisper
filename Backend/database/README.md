# SQLite connection storage

`credentials.db` stores the `database_credentials` table, with one row per
saved connection. `user_id` identifies the owner; a user can have multiple
connections. No user accounts or authentication are created by this module.

The table contains `id`, `user_id`, `host`, `port`, `dbname`, `username`,
`password`, `sslmode`, and `created_at`.

FastAPI initializes the table at startup without deleting existing records.
To initialize it manually from the project root:

```powershell
.\Backend\.venv\Scripts\python.exe -m Backend.database.sqlite
```

This uses Python's built-in `sqlite3`; no additional package is required.
The local database is ignored by Git. Passwords in this initial storage
schema are plaintext; add encryption with a separately managed key before
storing real users' credentials.

`POST /database/creatingEntry` accepts the `DatabaseConnection` fields plus
`user_id`, saves a connection, and returns its `id` with HTTP 201. It stores
the supplied credentials without testing the PostgreSQL connection.
The supplied user ID is not authenticated; this endpoint is for local use
until authentication and credential encryption are implemented.

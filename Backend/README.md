# SQLWhisper backend

Requires Python 3.10 or later. Run these commands from `C:\SQLWhisper`:

```powershell
python -m venv Backend/.venv
.\Backend\.venv\Scripts\python.exe -m pip install -r Backend/requirements.txt
.\Backend\.venv\Scripts\python.exe -m uvicorn Backend.main:app --reload
```

Open http://127.0.0.1:8000/docs to try the API.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Check server health |
| GET | `/items` | List items |
| POST | `/items` | Create an item |
| GET | `/items/{item_id}` | Retrieve an item (404 if missing) |

Example POST body:

```json
{"name": "Example", "description": "My first item"}
```

Routes live in `controller/items.py`. Item storage is in memory: restarting
the server clears it, and multiple workers do not share it. Use one worker
for this demo.

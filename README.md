# Aurion AI Signals

Aurion AI Signals is a minimal Python HTTP application that exposes a deterministic health response.

## Requirements

- Python 3.11 or newer

## Run

From a fresh clone, start the app with one command:

```bash
PYTHONPATH=src python -m aurion_ai_signals
```

The server listens on `http://127.0.0.1:8000` by default.

## Health check

After starting the app, request the health endpoint:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"message": "Aurion AI Signals is running", "status": "ok"}
```

You can also customize the bind address:

```bash
PYTHONPATH=src python -m aurion_ai_signals --host 0.0.0.0 --port 8080
```

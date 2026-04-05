# Backend deployment

This folder is the deploy surface for the FastAPI backend: one **Docker image**, multiple **process shapes** (embedded gateway vs four workers + proxy).

## Configuration model

| Variable | Purpose |
|----------|---------|
| `APP_ENV=production` | Do **not** load repo `.env` files; use only process environment (Kubernetes secrets, PaaS config, Compose substitution). |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | Google AI Studio API key (injected by the platform). |
| `DISABLE_CLIENT_GEMINI_KEY_HEADER=true` | Ignore `X-Gemini-Api-Key` from clients; **server secret only** (recommended in production). |
| `GATEWAY_MODE=embedded` | Single process: all routes in `gateway.main:app`. |
| `GATEWAY_MODE=proxy` | Gateway forwards `POST` routes to `INGESTION_SERVICE_URL`, `JD_SERVICE_URL`, `ANALYSIS_SERVICE_URL`, `OPTIMIZATION_SERVICE_URL`. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist for browsers. Empty → allow `*` (see `shared/cors.py`). |

Vertex AI: set `USE_VERTEX_AI=true`, `GOOGLE_CLOUD_PROJECT`, and `GOOGLE_CLOUD_LOCATION` instead of an API key.

## Docker Compose

From **`backend/deploy/`** (build context is **`backend/`**):

```bash
export GEMINI_API_KEY="your-key"
docker compose -f docker-compose.monolith.yml up --build
```

Microservices (five containers):

```bash
export GEMINI_API_KEY="your-key"
docker compose -f docker-compose.microservices.yml up --build
```

Optional: copy `env.example` to `.env` in this directory for Compose variable substitution only.

## Kubernetes (outline)

Use the **same image** for every service; only the container `command` / `args` differ.

- **Gemini workers** (ingestion, jd, analysis, optimization): env from a `Secret` (`GEMINI_API_KEY`), `APP_ENV=production`, `DISABLE_CLIENT_GEMINI_KEY_HEADER=true`, `PYTHONPATH=/app`, e.g. `uvicorn services.analysis.app:app --host 0.0.0.0 --port 8000`.
- **Gateway**: no API key; `GATEWAY_MODE=proxy`, `INGESTION_SERVICE_URL=http://ingestion:8000`, etc.; expose Service port 8000 to ingress.

Example fragments live under `kubernetes/` (adjust image registry and namespaces).

## Frontend (production build)

Point the SPA at the gateway URL. To hide the “Add Gemini key” UI when the API never accepts client keys:

```bash
VITE_HIDE_SESSION_GEMINI_UI=true npm run build
```

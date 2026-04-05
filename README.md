# Better Resume Builder

Parse a CV and a job description into structured JSON, run **match analysis** (ML keyword overlap + **LLM** fit + optional TF–IDF reference), and get **line-level edit suggestions** grounded in your resume. Optionally **tailor** the full resume JSON via `POST /optimize-cv`.

## Features

### Backend

- **Resume ingestion**: PDF/Word → structured JSON plus a **section outline** (counts, contact flags).
- **JD ingestion**: Paste (`POST /parse-jd-text`) or file (`POST /parse-jd`) → structured JD JSON + flattened text for matching.
- **Analysis** (`POST /analyze-resume`):
  - **LLM** returns `jd_keywords` and `resume_keywords` (extracted from the JD text and the structured resume), plus section rankings, line edits, and `fit_score_llm`.
  - **ML score** (`ml_metrics.ml_score_percent`): deterministic overlap on those keyword sets (Jaccard + JD recall blend, slightly conservative weights). If both lists are empty, it falls back to the legacy TF–IDF / token headline. The server applies a **strict reporting curve** to ML, LLM fit, section relevance, and the combined headline so scores are harder to “inflate.”
  - **Combined headline**: `round(0.5 × strict(ML) + 0.5 × strict(LLM fit))`.
  - **Lexical reference** (`lexical_metrics`): TF–IDF cosine, unigram Jaccard, matched/missing tokens — still returned for debugging and the UI “raw stats” panel.
  - Tunable request fields: **groundedness**, **creativity**, **temperature**, **professionalism** (see OpenAPI `/docs`).
- **Tailor (optional)**: `POST /optimize-cv` returns a rewritten `tailored_cv` + legacy ATS-style analytics.

### Frontend

- **Workspace**: Resizable **job / match** vs **What to change** split (default ~30/70; persisted in `localStorage`). Layout stacks on small screens; split drag only on large breakpoints.
- **Match summary**: **Combined**, **ML**, and **LLM** scores with green / amber / red bands; keyword chips from ML lists when present; by-section Lex (TF–IDF per section) + LLM + combined; raw TF–IDF stats in a collapsible section.
- **What to change**: Paginated **annotated preview** (highlights on suggested “before” text), optional **original PDF** tab when the upload was PDF, **Export PDF** of preview pages; suggestions grouped by resume entry with full entry text.
- **Dark / light** theme (toggle in header; persisted).
- **Monaco** JSON editor under **Raw resume data**; theme follows app light/dark.

## Tech stack

- **Frontend**: React, Vite, Tailwind v4, Zustand, Monaco, `react-pdf` / pdf.js, html2canvas + jsPDF for export.
- **Backend**: FastAPI, Google GenAI (Gemini), scikit-learn (TF–IDF).

## Branches

- **`development`**: local workflow with optional **`.env`** at the repo root or under `backend/` (`APP_ENV` defaults to development so dotenv loading is on). The UI can still send **`X-Gemini-Api-Key`** unless the server sets **`DISABLE_CLIENT_GEMINI_KEY_HEADER=true`**.
- **`deployment`**: production-oriented layout: **`APP_ENV=production`** so the app **does not read `.env` files** — inject **`GEMINI_API_KEY`** / **`GOOGLE_API_KEY`** via your host (Docker/Kubernetes/PaaS secrets). Prefer **`DISABLE_CLIENT_GEMINI_KEY_HEADER=true`** and build the frontend with **`VITE_HIDE_SESSION_GEMINI_UI=true`** to hide the session-key panel. See **`backend/deploy/README.md`** (Compose + Kubernetes templates).

## Local development

**1. Gateway (all routes, single process)**

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn gateway.main:app --reload --host 127.0.0.1 --port 8000
```

**2. Frontend**

```bash
cd frontend
npm install
npm run dev
```

Point the UI at the API: `frontend` defaults to `http://localhost:8000` (`API_BASE_URL` in `src/store/useStore.ts`).

**3. Environment**

Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) in `.env` at the repo root or under `backend/`.

**Optional — your key for this tab only (UI)**

In the app header, **Add Gemini key** stores a key in the browser’s **session storage** (not `localStorage`, not the server disk). Each request can send it as the header **`X-Gemini-Api-Key`**; the gateway uses it for that Gemini call instead of the server `.env` key. Closing the tab clears it. The backend does not persist this header.

## Microservices and gateway

Each domain has its own FastAPI app. **Local default**: `GATEWAY_MODE=embedded` — `gateway.main` loads all routers in one process.

| Service        | Module                      | Example port |
|----------------|-----------------------------|--------------|
| Resume ingest  | `services.ingestion.app`    | 8001         |
| JD ingest      | `services.jd.app`           | 8002         |
| Analysis       | `services.analysis.app`     | 8003         |
| CV tailor      | `services.optimization.app` | 8004         |

**Split deploy**: set `GATEWAY_MODE=proxy` and `INGESTION_SERVICE_URL`, `JD_SERVICE_URL`, `ANALYSIS_SERVICE_URL`, `OPTIMIZATION_SERVICE_URL` to the upstream base URLs. Docker Compose and Kubernetes examples live under **`backend/deploy/`**.

Run workers locally (from `backend/` with `PYTHONPATH=.`):

```bash
PYTHONPATH=. uvicorn services.ingestion.app:app --port 8001
PYTHONPATH=. uvicorn services.jd.app:app --port 8002
PYTHONPATH=. uvicorn services.analysis.app:app --port 8003
PYTHONPATH=. uvicorn services.optimization.app:app --port 8004
GATEWAY_MODE=proxy INGESTION_SERVICE_URL=http://127.0.0.1:8001 JD_SERVICE_URL=http://127.0.0.1:8002 ANALYSIS_SERVICE_URL=http://127.0.0.1:8003 OPTIMIZATION_SERVICE_URL=http://127.0.0.1:8004 PYTHONPATH=. uvicorn gateway.main:app --port 8000
```

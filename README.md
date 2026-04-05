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

- **`development`**: default local/Git workflow; use a server-side **`.env`** with `GEMINI_API_KEY` (or `GOOGLE_API_KEY`). The UI can still override per tab via **`X-Gemini-Api-Key`**.
- **`deployment` (planned)**: a later branch aimed at production-style deploys that rely on **session-only** keys from the browser (no committed `.env` on the host). Keep secrets out of git on both branches; this repo’s root **`.gitignore`** excludes `.env`.

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

## Microservice-style layout (split deploy later)

Each domain has its own FastAPI app; the **gateway** mounts them together for local dev.

| Service        | Module                      | Example port |
|----------------|-----------------------------|--------------|
| Resume ingest  | `services.ingestion.app`    | 8001         |
| JD ingest      | `services.jd.app`           | 8002         |
| Analysis       | `services.analysis.app`     | 8003         |
| CV tailor      | `services.optimization.app` | 8004         |

Run standalone (from `backend/` with `PYTHONPATH=.`):

```bash
PYTHONPATH=. uvicorn services.ingestion.app:app --port 8001
PYTHONPATH=. uvicorn services.jd.app:app --port 8002
PYTHONPATH=. uvicorn services.analysis.app:app --port 8003
PYTHONPATH=. uvicorn services.optimization.app:app --port 8004
```

Point a future BFF gateway at these URLs via HTTP clients when you split the monolith.

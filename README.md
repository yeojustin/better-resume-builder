# Better Resume Builder

Parse a CV and a job description into structured JSON, run **match analysis** (ML keyword overlap + **LLM** fit + optional TF–IDF reference), and get **line-level edit suggestions** grounded in your resume. Optionally **tailor** the full resume JSON via `POST /optimize-cv`.

## Tech stack

- **Frontend**: React, Vite, Tailwind v4, Zustand, Monaco, `react-pdf` / pdf.js, html2canvas + jsPDF.
- **Backend**: FastAPI, Google GenAI (Gemini), scikit-learn (TF–IDF).

---

## Run locally

### Prerequisites

- **Python 3.12+** (recommended) and **Node.js 20+**
- A **Google AI (Gemini) API key** ([Google AI Studio](https://aistudio.google.com/apikey))

### 1. Backend API (gateway)

From the repo root:

```bash
cd backend
pip install -r requirements.txt
PYTHONPATH=. uvicorn gateway.main:app --reload --host 127.0.0.1 --port 8000
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000) — OpenAPI docs at `/docs`.
- Default mode is **`GATEWAY_MODE=embedded`** (all routes in one process).

### 2. Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

- App: [http://127.0.0.1:5173](http://127.0.0.1:5173) (Vite default).

### 3. Gemini API key (local)

**Default (session key):** On first load, the app asks for your key. It is stored in the tab’s **session storage** and sent as **`X-Gemini-Api-Key`** on each request. In development, the backend normally **does not** use `GEMINI_API_KEY` / `GOOGLE_API_KEY` from `.env` so your session key is the source of truth.

- To use **`.env` / shell** keys for Gemini instead: set **`GEMINI_SESSION_ONLY=false`** before starting the backend (optional `.env` at repo root or `backend/` as in older workflows).

**Optional — point the UI at a different API host** (e.g. remote backend):

```bash
VITE_API_BASE_URL=https://your-api-host.example.com npm run dev
```

If unset, the client defaults to **`http://localhost:8000`**.

---

## Deploy (production)

### Backend

- Set **`APP_ENV=production`** so the app **does not** read repository `.env` files; inject secrets via your platform (Docker/Kubernetes/PaaS).
- Provide **`GEMINI_API_KEY`** or **`GOOGLE_API_KEY`** in the container/process environment.
- Set **`DISABLE_CLIENT_GEMINI_KEY_HEADER=true`** so browsers cannot override the server key with a header (recommended).
- Set **`ALLOWED_ORIGINS`** to a comma-separated list of your **frontend origins** for CORS (or leave empty only if you accept the default CORS behavior documented in `backend/shared/cors.py`).

**Docker (single container, embedded gateway)** — from `backend/deploy/`:

```bash
export GEMINI_API_KEY="your-key"
docker compose -f docker-compose.monolith.yml up --build
```

Build context and full variable list: **`backend/deploy/README.md`**. The image build uses **`backend/.dockerignore`** so `.env` files are not copied into the image.

**Microservices + proxy gateway** — see `docker-compose.microservices.yml` and the same deploy README.

### Frontend (production build)

Build a static bundle and host it (S3+CloudFront, nginx, Vercel, etc.). You must set the **public API URL** and hide session-key UI when the API rejects client keys:

```bash
cd frontend
VITE_API_BASE_URL=https://api.yourdomain.com \
VITE_HIDE_SESSION_GEMINI_UI=true \
npm run build
```

Output is under **`frontend/dist/`**. Serve `index.html` and assets; configure your CDN or reverse proxy so the browser can call `VITE_API_BASE_URL` with CORS allowed by the backend.

---

## Features (overview)

### Backend

- Resume ingestion (PDF/Word → JSON + outline), JD ingestion (paste or file), **`POST /analyze-resume`** (LLM + ML + lexical reference), optional **`POST /optimize-cv`**.

### Frontend

- Job vs “What to change” workspace, match summary, annotated preview + PDF export, dark/light theme, Monaco JSON editor for raw resume data.

---

## Branches

- **`development`** — day-to-day feature work.
- **`deployment`** — release line aligned with production env (no runtime `.env` in containers, secrets from the host). This README describes how to run and ship that layout.

---

## Microservices (advanced)

Each domain has its own FastAPI app. Local default: **`GATEWAY_MODE=embedded`**. For split processes, set **`GATEWAY_MODE=proxy`** and `INGESTION_SERVICE_URL`, `JD_SERVICE_URL`, `ANALYSIS_SERVICE_URL`, `OPTIMIZATION_SERVICE_URL`. Example local commands and ports are in **`backend/deploy/README.md`**.

```bash
# Example: workers + proxy gateway (from backend/, PYTHONPATH=.)
PYTHONPATH=. uvicorn services.ingestion.app:app --port 8001
# … jd 8002, analysis 8003, optimization 8004 …
GATEWAY_MODE=proxy \
  INGESTION_SERVICE_URL=http://127.0.0.1:8001 \
  JD_SERVICE_URL=http://127.0.0.1:8002 \
  ANALYSIS_SERVICE_URL=http://127.0.0.1:8003 \
  OPTIMIZATION_SERVICE_URL=http://127.0.0.1:8004 \
  PYTHONPATH=. uvicorn gateway.main:app --port 8000
```

"""
HTTP reverse proxy gateway: forwards to separately deployed microservices.

Set ``GATEWAY_MODE=proxy`` and point ``*_SERVICE_URL`` at each service base URL
(no trailing path). The gateway does not call Gemini itself.
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from shared.cors import get_cors_middleware_kwargs

HOP_BY_HOP = frozenset(
    {
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
        "host",
        "content-length",
    }
)


def _service_urls() -> dict[str, str]:
    return {
        "ingestion": os.getenv("INGESTION_SERVICE_URL", "http://127.0.0.1:8001").rstrip("/"),
        "jd": os.getenv("JD_SERVICE_URL", "http://127.0.0.1:8002").rstrip("/"),
        "analysis": os.getenv("ANALYSIS_SERVICE_URL", "http://127.0.0.1:8003").rstrip("/"),
        "optimization": os.getenv("OPTIMIZATION_SERVICE_URL", "http://127.0.0.1:8004").rstrip("/"),
    }


ROUTE_TARGETS: list[tuple[str, str]] = [
    ("/parse-resume", "ingestion"),
    ("/parse-jd", "jd"),
    ("/parse-jd-text", "jd"),
    ("/analyze-resume", "analysis"),
    ("/optimize-cv", "optimization"),
]


def create_proxy_app() -> FastAPI:
    urls = _service_urls()
    timeout = httpx.Timeout(600.0)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.http = httpx.AsyncClient(timeout=timeout)
        yield
        await app.state.http.aclose()

    application = FastAPI(
        title="Better Resume Builder API — proxy gateway",
        description="Forwards to microservices; set INGESTION_SERVICE_URL, JD_SERVICE_URL, etc.",
        version="2.0.0",
        lifespan=lifespan,
    )
    application.add_middleware(CORSMiddleware, **get_cors_middleware_kwargs())

    async def forward(request: Request, service_key: str) -> Response:
        client: httpx.AsyncClient = request.app.state.http
        base = urls[service_key]
        url = base + request.url.path
        body = await request.body()
        out_headers: dict[str, str] = {}
        for k, v in request.headers.items():
            if k.lower() in HOP_BY_HOP:
                continue
            out_headers[k] = v
        try:
            upstream = await client.request(
                request.method,
                url,
                content=body if body else None,
                headers=out_headers,
            )
        except httpx.RequestError as e:
            payload = json.dumps({"detail": f"upstream unreachable: {e!s}"})
            return Response(
                content=payload.encode("utf-8"),
                status_code=502,
                media_type="application/json",
            )
        resp_headers = {
            k: v
            for k, v in upstream.headers.items()
            if k.lower() not in HOP_BY_HOP and k.lower() != "content-length"
        }
        return Response(
            content=upstream.content,
            status_code=upstream.status_code,
            headers=resp_headers,
            media_type=upstream.headers.get("content-type"),
        )

    def register_route(path: str, service_key: str) -> None:
        sk = service_key

        async def handler(request: Request) -> Response:
            return await forward(request, sk)

        application.add_api_route(path, handler, methods=["POST"])

    for path, sk in ROUTE_TARGETS:
        register_route(path, sk)

    @application.get("/")
    async def root():
        return {
            "status": "Better Resume Builder — proxy gateway online",
            "mode": "proxy",
            "targets": urls,
        }

    @application.get("/health")
    async def health():
        return {"status": "ok", "mode": "proxy"}

    return application

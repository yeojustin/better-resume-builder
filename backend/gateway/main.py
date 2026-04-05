"""
API entry: embedded monolith (default) or HTTP proxy to microservices.

  embedded:  GATEWAY_MODE=embedded  (default) — all routers in-process
  proxy:     GATEWAY_MODE=proxy    — forwards to INGESTION_SERVICE_URL, JD_SERVICE_URL, …

Load order: bootstrap env before importing apps that pull ``shared.config``.
"""

import os

from shared.env_bootstrap import bootstrap_runtime_env

bootstrap_runtime_env()

if os.getenv("GATEWAY_MODE", "embedded").strip().lower() == "proxy":
    from gateway.proxy_app import create_proxy_app

    app = create_proxy_app()
else:
    from gateway.embedded_app import create_embedded_app

    app = create_embedded_app()

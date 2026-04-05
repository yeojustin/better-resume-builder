# Kubernetes examples

These are **templates**: replace `YOUR_REGISTRY/better-resume-backend:latest`, namespaces, and ingress hostnames.

Patterns:

1. **Secret** — holds `GEMINI_API_KEY` (or mount from your secret manager).
2. **Deployments** — one image; workers run `services.<name>.app:app`; gateway runs `gateway.main:app` with `GATEWAY_MODE=proxy` and internal service URLs.
3. **Services** — ClusterIP on port 8000 per deployment.

See `deployment-gateway.yaml` and `deployment-worker.yaml` for starting points.

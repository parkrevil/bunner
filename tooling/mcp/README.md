# bunner-kb HTTP server (REST)

Knowledge graph HTTP server for the Bunner codebase. Exposes 18 tools (search, describe, relations, impact_analysis, etc.) via REST.

## Running the HTTP server

1. Start: `bun run kb:http` (from repo root).
2. Liveness: `GET http://127.0.0.1:9242/health`.
3. Tool metadata: `GET http://127.0.0.1:9242/tools`.

Port: `BUNNER_KB_HTTP_PORT` (default 9242). See [src/http-server.ts](src/http-server.ts) for endpoints and known issues (e.g. occasional client "fetch failed").

## Scripts (from repo root)

- `bun run kb:http` — HTTP server (REST at /tools).
- `bun run kb:http:verify` — HTTP server must be running; calls all 19 tools via REST.

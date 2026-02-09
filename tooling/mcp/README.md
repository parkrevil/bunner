# bunner-kb MCP server

Knowledge graph MCP server for the Bunner codebase. Exposes 19 tools (search, describe, relations, impact_analysis, etc.) via stdio or HTTP.

## Running the HTTP server (recommended for Cursor)

1. Start: `bun run kb:http` (from repo root).
2. Configure Cursor MCP: Transport = Streamable HTTP, URL = `http://127.0.0.1:9242/mcp`.
3. Liveness: `GET http://127.0.0.1:9242/health`.

Port: `BUNNER_HTTP_PORT` (default 9242). See [src/http-server.ts](src/http-server.ts) for endpoints and known issues (e.g. occasional client "fetch failed").

## Scripts (from repo root)

- `bun run kb:http` — HTTP server (MCP at /mcp, REST at /tools).
- `bun run kb:mcp` — stdio MCP (for CLI usage).
- `bun run kb:http:verify` — HTTP server must be running; calls all 19 tools via REST.

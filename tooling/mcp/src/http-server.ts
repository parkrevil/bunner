/**
 * HTTP server for bunner-kb: MCP over HTTP (Streamable) + REST tools.
 * Use this instead of stdio so Cursor does not hang on large responses.
 *
 * Endpoints:
 *   GET  /health       — liveness (ok: true)
 *   GET/POST /mcp      — MCP Streamable HTTP (for Cursor)
 *   GET  /tools        — list tool names (REST)
 *   POST /tools/:name  — invoke tool; body = JSON arguments (REST)
 *
 * Operational (run before using MCP from Cursor):
 *   1. Start server: bun run kb:http
 *   2. Cursor: Settings → MCP → Add new → Transport: Streamable HTTP → URL: http://127.0.0.1:9242/mcp
 *   3. Check liveness: GET http://127.0.0.1:9242/health
 *
 * Port: BUNNER_HTTP_PORT (default 9242).
 * Known issue: Cursor may occasionally show "Client error for command fetch failed"; server may still be up.
 * Retry or verify with GET /health. Server logs [mcp] request/completed/failed for debugging.
 */

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createBunnerKbServer, TOOL_DEFINITIONS } from './server';

const PORT = Number(process.env.BUNNER_HTTP_PORT ?? '9242');

const { server, callTool } = createBunnerKbServer();

const mcpTransport = new WebStandardStreamableHTTPServerTransport({
	sessionIdGenerator: () => crypto.randomUUID(),
});
await server.connect(mcpTransport);

function syncResponse(req: Request): Response {
	const url = new URL(req.url);
	if (url.pathname === '/health' && req.method === 'GET') {
		return Response.json({ ok: true, mcp: '/mcp', tools: '/tools' });
	}
	if (url.pathname === '/tools' && req.method === 'GET') {
		const names = TOOL_DEFINITIONS.map((t) => t.name);
		return Response.json({ tools: names });
	}
	return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), {
		status: 404,
		headers: { 'Content-Type': 'application/json' },
	});
}

const g = globalThis as { __BUNNER_MCP_VIA_HTTP?: boolean };

async function fetchAsync(req: Request): Promise<Response> {
	const url = new URL(req.url);
	if (url.pathname === '/mcp' || url.pathname === '/mcp/') {
		g.__BUNNER_MCP_VIA_HTTP = true;
		const sessionId = req.headers.get('mcp-session-id') ?? undefined;
		const start = Date.now();
		console.log('[mcp] request', req.method, url.pathname, sessionId ? `session=${sessionId.slice(0, 8)}...` : '');
		try {
			const res = await mcpTransport.handleRequest(req);
			console.log('[mcp] completed', req.method, url.pathname, `${Date.now() - start}ms`);
			return res;
		} catch (err) {
			console.error('[mcp] handleRequest failed', err);
			return new Response(
				JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
				{ status: 500, headers: { 'Content-Type': 'application/json' } },
			);
		} finally {
			g.__BUNNER_MCP_VIA_HTTP = false;
		}
	}
	const match = url.pathname.match(/^\/tools\/([a-z_]+)$/);
	if (match && req.method === 'POST') {
		return handleToolInvoke(req, match[1]!);
	}
	return syncResponse(req);
}

async function handleToolInvoke(req: Request, toolName: string): Promise<Response> {
	let args: Record<string, unknown> = {};
	try {
		const body = await req.text();
		if (body) args = JSON.parse(body) as Record<string, unknown>;
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
	}
	const result = await callTool(toolName, args);
	const text = result.content[0]?.text ?? '{}';
	const status = result.isError ? 500 : 200;
	return new Response(text, {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

Bun.serve({
	port: PORT,
	// 120s so long-running MCP tool calls (e.g. sync, search) do not close the connection
	idleTimeout: 120,
	fetch(req) {
		return fetchAsync(req);
	},
});

console.log(`bunner-kb HTTP server: MCP http://127.0.0.1:${PORT}/mcp  REST http://127.0.0.1:${PORT}/tools`);

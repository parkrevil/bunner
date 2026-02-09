/**
 * HTTP server for bunner-kb: REST tools (agent-friendly).
 *
 * Endpoints:
 *   GET  /health       — liveness (ok: true)
 *   GET  /tools        — list tool definitions (name/description/schema)
 *   POST /tools/:name  — invoke tool; body = JSON arguments (REST)
 *
 * Operational:
 *   1. Start server: bun run kb:http
 *   2. Check liveness: GET http://127.0.0.1:9242/health
 *
 * Port: BUNNER_KB_HTTP_PORT (default 9242).
 */

import { createBunnerKbServer, TOOL_DEFINITIONS } from './server';

const PORT = Number(process.env.BUNNER_KB_HTTP_PORT ?? '9242');

const { callTool, bootstrap } = createBunnerKbServer();
await bootstrap();

function syncResponse(req: Request): Response {
	const url = new URL(req.url);
	if (url.pathname === '/health' && req.method === 'GET') {
		return Response.json({ ok: true, tools: '/tools' });
	}
	if (url.pathname === '/tools' && req.method === 'GET') {
		return Response.json({ tools: TOOL_DEFINITIONS, count: TOOL_DEFINITIONS.length });
	}
	return new Response(JSON.stringify({ error: 'Not found', path: url.pathname }), {
		status: 404,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function fetchAsync(req: Request): Promise<Response> {
	const url = new URL(req.url);
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

console.log(`bunner-kb HTTP server: REST http://127.0.0.1:${PORT}/tools`);

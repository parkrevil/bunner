/**
 * Verify all 19 tools via HTTP server (not MCP).
 * Start the server first: bun run kb:http
 * Then run: bun tooling/mcp/test/integration/tools/_http-verify-all.ts
 */

const BASE = process.env.BUNNER_HTTP_BASE ?? 'http://127.0.0.1:9242';

async function getTools(): Promise<string[]> {
	const r = await fetch(`${BASE}/tools`);
	if (!r.ok) throw new Error(`GET /tools failed: ${r.status}`);
	const j = (await r.json()) as { tools?: Array<{ name?: string }>; count?: number };
	const defs = j.tools ?? [];
	const names = defs.map((t) => t.name).filter((n): n is string => typeof n === 'string' && n.length > 0);
	return names;
}

async function callTool(name: string, args: Record<string, unknown> = {}): Promise<{ ok: boolean; status: number; text: string }> {
	const r = await fetch(`${BASE}/tools/${name}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(args),
	});
	const text = await r.text();
	return { ok: r.ok, status: r.status, text };
}

const TOOL_ARGS: Record<string, Record<string, unknown>> = {
	search: { query: 'export', limit: 3 },
	describe: { entityKey: 'file::packages/core/src/index.ts' },
	relations: { entityKey: 'file::packages/core/src/index.ts', limit: 3 },
	facts: { entityKey: 'file::packages/core/src/index.ts', limit: 3 },
	evidence: { relationId: 1 },
	impact_analysis: { entityKey: 'file::packages/core/src/index.ts', depth: 2 },
	dependency_graph: { entityKey: 'file::packages/core/src/index.ts', depth: 2 },
	trace_chain: { fromKey: 'file::packages/core/src/index.ts', toKey: 'file::packages/common/src/index.ts' },
	coverage_map: { specKey: 'spec::di.spec' },
	inconsistency_report: { scope: 'structural' },
	find_orphans: {},
	recent_changes: { limit: 3 },
	changelog: { entityKey: 'file::packages/core/src/index.ts', limit: 3 },
	verify_integrity: { level: 'structural' },
	sync: { scope: 'changed', dryRun: true },
	purge_tombstones: {},
	bulk_describe: { entityKeys: ['file::packages/core/src/index.ts', 'file::packages/common/src/index.ts'] },
	bulk_facts: { entityKeys: ['file::packages/core/src/index.ts'] },
};

async function main() {
	console.log(`HTTP base: ${BASE}\n`);
	let tools: string[];
	try {
		tools = await getTools();
		console.log(`Tools: ${tools.length}\n`);
	} catch (e) {
		console.error('Failed to GET /tools. Is the server running? (bun run kb:http)\n', e);
		process.exit(1);
	}
	let ok = 0;
	let fail = 0;
	for (const name of tools) {
		const args = TOOL_ARGS[name] ?? {};
		const { ok: success, status, text } = await callTool(name, args);
		if (success) {
			ok++;
			console.log(`  ✅ ${name} (${status})`);
		} else {
			fail++;
			const preview = text.slice(0, 120).replace(/\n/g, ' ');
			console.log(`  ❌ ${name} (${status}) ${preview}${text.length > 120 ? '...' : ''}`);
		}
	}
	console.log(`\nResult: ${ok} ok, ${fail} fail`);
	process.exit(fail > 0 ? 1 : 0);
}

main();

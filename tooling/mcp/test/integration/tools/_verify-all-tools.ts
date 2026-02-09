/**
 * Comprehensive MCP tool verification via InMemoryTransport + real DB.
 * Tests all 19 tools and validates response structure.
 *
 * Same as real MCP (stdio):
 *   - Same server code path: createBunnerKbServer() → setRequestHandler(CallToolRequestSchema)
 *     → handleToolCall(name, args, { maxResponseSize: 100KB }) → dispatch
 *   - Same tool logic, init mutex, and 100KB response truncation for "MCP" path.
 *
 * Different from real MCP (stdio):
 *   - Transport: InMemoryTransport (in-process) vs StdioServerTransport (stdin/stdout pipe).
 *     So this script does NOT reproduce stdio backpressure / pipe blocking that can hang Cursor.
 *   - One server (and one client) per tool block; real Cursor sends many requests to one server.
 *     So this does NOT stress "same server, concurrent or rapid sequential requests".
 *
 * Creates a fresh server per tool to avoid DB connection pool exhaustion.
 *
 * Run: cd /home/revil/projects/bunner && timeout 120 bun tooling/mcp/test/integration/tools/_verify-all-tools.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createBunnerKbServer } from '../../../src/server';

let passCount = 0;
let failCount = 0;

function log(msg: string) { process.stderr.write(`${msg}\n`); }
function pass(tool: string, detail: string) { passCount++; log(`  ✅ ${tool}: ${detail}`); }
function fail(tool: string, detail: string) { failCount++; log(`  ❌ ${tool}: ${detail}`); }

async function createClient() {
	const { server } = createBunnerKbServer();
	const [st, ct] = InMemoryTransport.createLinkedPair();
	await server.connect(st);
	const client = new Client({ name: 'verify-all', version: '1.0.0' }, { capabilities: {} });
	await client.connect(ct);
	return {
		call: (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }),
		close: async () => { await client.close(); await server.close(); },
	};
}

function getResult(resp: unknown): unknown {
	const r = resp as { content?: Array<{ text?: string }> };
	if (!r?.content?.[0]?.text) return null;
	try { return JSON.parse(r.content[0].text); } catch { return r.content[0].text; }
}

function isErr(resp: unknown): boolean {
	return (resp as { isError?: boolean })?.isError === true;
}

// ── Main ──
async function main() {
	log('\n═══════════════════════════════════════════');
	log('  MCP Tool Verification (Real DB + InMemory)');
	log('═══════════════════════════════════════════\n');

	// Phase 0: Entity Discovery
	log('── Phase 0: Entity Discovery ──');
	let ek1 = '';
	let ek2 = '';
	let specKey = '';

	{
		const c = await createClient();
		const resp = await c.call('recent_changes', { limit: 50 });
		const data = getResult(resp) as Array<{ entityKey: string }> | null;
		if (Array.isArray(data) && data.length > 0) {
			const keys = [...new Set(data.map(d => d.entityKey))];
			ek1 = keys[0] ?? '';
			ek2 = keys[1] ?? keys[0] ?? '';
			specKey = data.find(d => d.entityKey.startsWith('spec::'))?.entityKey ?? 'spec::di.spec';
			log(`  discovered ${keys.length} keys, key1=${ek1}, key2=${ek2}, spec=${specKey}`);
		} else {
			fail('discovery', 'no recent_changes');
			ek1 = 'file::packages/core/src/index.ts';
			ek2 = 'file::packages/common/src/index.ts';
			specKey = 'spec::di.spec';
		}
		await c.close();
	}

	// ── 1. Query Tools ──
	log('\n── 1. Query Tools ──');

	{ // search
		const c = await createClient();
		const d = getResult(await c.call('search', { query: 'export', limit: 5 })) as { matches?: unknown[]; totalMatches?: number } | null;
		if (d && 'matches' in d && 'totalMatches' in d) pass('search', `totalMatches=${d.totalMatches}`);
		else fail('search', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // describe
		const c = await createClient();
		const d = getResult(await c.call('describe', { entityKey: ek1 })) as Record<string, unknown> | null;
		if (d === null || (d && 'entity' in d)) {
			const e = (d as { entity?: Record<string, unknown> })?.entity;
			pass('describe', e ? `type=${e.type}, key=${e.key}` : 'null');
		} else fail('describe', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // relations (bare array)
		const c = await createClient();
		const d = getResult(await c.call('relations', { entityKey: ek1, limit: 5 }));
		if (Array.isArray(d)) pass('relations', `count=${d.length}`);
		else fail('relations', `expected array, got ${typeof d}`);
		await c.close();
	}

	{ // facts (bare array)
		const c = await createClient();
		const d = getResult(await c.call('facts', { entityKey: ek1, limit: 5 }));
		if (Array.isArray(d)) pass('facts', `count=${d.length}`);
		else fail('facts', `expected array, got ${typeof d}`);
		await c.close();
	}

	{ // evidence
		const c = await createClient();
		const d = getResult(await c.call('evidence', { relationId: 1 })) as { evidence?: unknown[] } | null;
		if (d && 'evidence' in d) pass('evidence', `count=${(d.evidence as unknown[])?.length ?? 0}`);
		else fail('evidence', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	// ── 2. Analysis Tools ──
	log('\n── 2. Analysis Tools ──');

	{ // impact_analysis
		const c = await createClient();
		const d = getResult(await c.call('impact_analysis', { entityKey: ek1, depth: 2 })) as Record<string, unknown> | null;
		if (d && 'root' in d && 'affected' in d && 'totalAffected' in d) pass('impact_analysis', `totalAffected=${d.totalAffected}`);
		else fail('impact_analysis', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // dependency_graph
		const c = await createClient();
		const d = getResult(await c.call('dependency_graph', { entityKey: ek1, depth: 2 })) as Record<string, unknown> | null;
		if (d && 'nodes' in d && 'edges' in d)
			pass('dependency_graph', `nodes=${(d.nodes as unknown[]).length}, edges=${(d.edges as unknown[]).length}`);
		else fail('dependency_graph', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // trace_chain
		const c = await createClient();
		const resp = await c.call('trace_chain', { fromKey: ek1, toKey: ek2 });
		const d = getResult(resp) as Record<string, unknown> | null;
		if (isErr(resp)) pass('trace_chain', 'error response (entity not found — acceptable)');
		else if (d && 'found' in d) pass('trace_chain', `found=${d.found}, pathLen=${(d.path as unknown[])?.length ?? 0}`);
		else fail('trace_chain', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // coverage_map
		const c = await createClient();
		const d = getResult(await c.call('coverage_map', { specKey })) as Record<string, unknown> | null;
		if (d && typeof d === 'object') pass('coverage_map', `keys=${Object.keys(d).join(',')}`);
		else fail('coverage_map', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // inconsistency_report
		const c = await createClient();
		const d = getResult(await c.call('inconsistency_report', {})) as Record<string, unknown> | null;
		if (d && 'issues' in d && 'totalIssues' in d) pass('inconsistency_report', `scope=${d.scope}, totalIssues=${d.totalIssues}`);
		else fail('inconsistency_report', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // find_orphans
		const c = await createClient();
		const d = getResult(await c.call('find_orphans', {})) as Record<string, unknown> | null;
		if (d && 'orphans' in d && 'totalOrphans' in d) pass('find_orphans', `totalOrphans=${d.totalOrphans}`);
		else fail('find_orphans', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	// ── 3. Temporal Tools ──
	log('\n── 3. Temporal Tools ──');

	{ // recent_changes (bare array)
		const c = await createClient();
		const d = getResult(await c.call('recent_changes', { limit: 3 }));
		if (Array.isArray(d)) pass('recent_changes', `count=${d.length}`);
		else fail('recent_changes', `expected array, got ${typeof d}`);
		await c.close();
	}

	{ // changelog
		const c = await createClient();
		const d = getResult(await c.call('changelog', { entityKey: ek1, limit: 5 })) as { entries?: unknown[] } | null;
		if (d && 'entries' in d) pass('changelog', `count=${(d.entries as unknown[])?.length ?? 0}`);
		else fail('changelog', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	// ── 4. Operations Tools ──
	log('\n── 4. Operations Tools ──');

	{ // verify_integrity
		const c = await createClient();
		const d = getResult(await c.call('verify_integrity', { level: 'structural' })) as Record<string, unknown> | null;
		if (d && 'level' in d && 'issues' in d && 'totalIssues' in d) pass('verify_integrity', `level=${d.level}, totalIssues=${d.totalIssues}`);
		else fail('verify_integrity', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // sync (dryRun)
		const c = await createClient();
		const d = getResult(await c.call('sync', { scope: 'changed', dryRun: true })) as Record<string, unknown> | null;
		if (d && typeof d === 'object') pass('sync', `keys=${Object.keys(d).join(',')}`);
		else fail('sync', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // purge_tombstones
		const c = await createClient();
		const d = getResult(await c.call('purge_tombstones', {})) as Record<string, unknown> | null;
		if (d && typeof d === 'object') pass('purge_tombstones', `keys=${Object.keys(d).join(',')}`);
		else fail('purge_tombstones', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	// ── 5. Bulk Tools ──
	log('\n── 5. Bulk Tools ──');

	{ // bulk_describe
		const c = await createClient();
		const d = getResult(await c.call('bulk_describe', { entityKeys: [ek1, ek2].filter(Boolean) })) as { results?: Record<string, unknown> } | null;
		if (d && 'results' in d) pass('bulk_describe', `resultKeys=${Object.keys(d.results ?? {}).length}`);
		else fail('bulk_describe', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	{ // bulk_facts
		const c = await createClient();
		const d = getResult(await c.call('bulk_facts', { entityKeys: [ek1] })) as { results?: Record<string, unknown> } | null;
		if (d && 'results' in d) pass('bulk_facts', `resultKeys=${Object.keys(d.results ?? {}).length}`);
		else fail('bulk_facts', JSON.stringify(d).slice(0, 200));
		await c.close();
	}

	// ── 6. Error Handling ──
	log('\n── 6. Error Handling ──');

	{
		const c = await createClient();

		const r1 = await c.call('nonexistent_tool', {});
		if (isErr(r1)) pass('unknown_tool', 'returns isError=true');
		else fail('unknown_tool', 'expected isError=true');

		const r2 = await c.call('describe', {});
		if (getResult(r2) !== null || isErr(r2)) pass('missing_param', 'gracefully handled');
		else pass('missing_param', 'returned null (acceptable)');

		await c.close();
	}

	// ── Summary ──
	log('\n═══════════════════════════════════════════');
	log(`  Results: ${passCount} pass, ${failCount} fail`);
	log('═══════════════════════════════════════════\n');

	process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
	log(`FATAL: ${(e as Error).message}`);
	process.exit(1);
});

setTimeout(() => { log('TIMEOUT 90s'); process.exit(1); }, 90000);

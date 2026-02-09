/**
 * Diagnostic: Test MCP server via stdio transport (same as VS Code does).
 * Run: cd /home/revil/projects/bunner && timeout 15 bun tooling/mcp/test/integration/tools/_stdio-diag.ts
 */
import { spawn, type ChildProcess } from 'child_process';
import { join } from 'path';

const ROOT = join(import.meta.dir, '../../../../..');
const SERVER_PATH = join(ROOT, 'tooling/mcp/src/server.ts');

function log(msg: string) {
	process.stderr.write(`[diag] ${msg}\n`);
}

// ── Spawn MCP server ──
log(`spawning: bun --env-file=.env ${SERVER_PATH}`);
const proc: ChildProcess = spawn('bun', ['--env-file=.env', SERVER_PATH], {
	cwd: ROOT,
	stdio: ['pipe', 'pipe', 'pipe'],
});

proc.stderr!.on('data', (d: Buffer) => {
	for (const line of d.toString().split('\n').filter(Boolean)) {
		log(`[server stderr] ${line}`);
	}
});

proc.on('exit', (code, sig) => log(`[server exit] code=${code} signal=${sig}`));

// ── Message parser (newline-delimited JSON) ──
let buf = '';
const pendingResponses = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

proc.stdout!.on('data', (chunk: Buffer) => {
	buf += chunk.toString();
	let nlIdx: number;
	while ((nlIdx = buf.indexOf('\n')) !== -1) {
		const line = buf.slice(0, nlIdx).replace(/\r$/, '');
		buf = buf.slice(nlIdx + 1);
		if (!line) continue;
		try {
			const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: unknown };
			log(`[response] id=${msg.id} result=${JSON.stringify(msg.result ?? msg.error).slice(0, 300)}`);
			const pending = pendingResponses.get(msg.id!);
			if (pending) {
				pendingResponses.delete(msg.id!);
				pending.resolve(msg);
			}
		} catch (e) {
			log(`[parse error] ${(e as Error).message} — line: ${line.slice(0, 100)}`);
		}
	}
});

function sendRequest(id: number, method: string, params: unknown): Promise<unknown> {
	return new Promise((resolve, reject) => {
		pendingResponses.set(id, { resolve, reject });
		const line = JSON.stringify({ jsonrpc: '2.0', id, method, params });
		log(`[send] id=${id} method=${method}`);
		proc.stdin!.write(line + '\n');
	});
}

function sendNotification(method: string, params?: unknown) {
	const line = JSON.stringify({ jsonrpc: '2.0', method, params: params ?? {} });
	proc.stdin!.write(line + '\n');
	log(`[notify] ${method}`);
}

// ── Test sequence ──
async function main() {
	// Wait for server to start
	await new Promise(r => setTimeout(r, 500));

	log('--- Step 1: initialize ---');
	const initResult = await sendRequest(1, 'initialize', {
		protocolVersion: '2024-11-05',
		capabilities: {},
		clientInfo: { name: 'stdio-diag', version: '1.0.0' },
	});
	log(`init done: ${JSON.stringify(initResult).slice(0, 200)}`);

	sendNotification('notifications/initialized');

	log('--- Step 2: search ---');
	const searchResult = await sendRequest(2, 'tools/call', { name: 'search', arguments: { query: 'server' } });
	log(`search done: ${JSON.stringify(searchResult).slice(0, 300)}`);

	log('--- Step 3: describe ---');
	const descResult = await sendRequest(3, 'tools/call', {
		name: 'describe',
		arguments: { entityKey: 'file::tooling/mcp/src/server.ts' },
	});
	log(`describe done: ${JSON.stringify(descResult).slice(0, 300)}`);

	log('--- ALL DONE ---');
	proc.kill('SIGTERM');
	setTimeout(() => process.exit(0), 1000);
}

main().catch(e => {
	log(`FATAL: ${(e as Error).message}`);
	proc.kill();
	process.exit(1);
});

setTimeout(() => {
	log('TIMEOUT after 12s');
	proc.kill();
	process.exit(1);
}, 12000);

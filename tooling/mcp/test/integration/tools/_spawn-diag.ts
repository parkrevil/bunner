/**
 * Minimal test: Does Bun even start the server process?
 */
import { spawn } from 'child_process';
import { join } from 'path';

const ROOT = join(import.meta.dir, '../../../../..');

function log(msg: string) { process.stderr.write(`[diag] ${msg}\n`); }

// Test 1: Just echo something from the child
log('=== Test 1: Basic spawn ===');
const p1 = spawn('bun', ['-e', 'process.stderr.write("ALIVE\\n"); process.stdout.write("HELLO\\n");'], {
	cwd: ROOT,
	stdio: ['pipe', 'pipe', 'pipe'],
});
p1.stderr!.on('data', (d: Buffer) => log(`[T1 err] ${d.toString().trim()}`));
p1.stdout!.on('data', (d: Buffer) => log(`[T1 out] ${d.toString().trim()}`));
p1.on('exit', (code) => log(`[T1 exit] ${code}`));

await new Promise(r => setTimeout(r, 1500));

// Test 2: Minimal MCP server as separate file
log('=== Test 2: Spawn actual server with --env-file ===');
const p2 = spawn('bun', ['--env-file=.env', join(ROOT, 'tooling/mcp/src/server.ts')], {
	cwd: ROOT,
	stdio: ['pipe', 'pipe', 'pipe'],
});

let p2alive = false;
p2.stderr!.on('data', (d: Buffer) => { p2alive = true; log(`[T2 err] ${d.toString().trim()}`); });
p2.stdout!.on('data', (d: Buffer) => { p2alive = true; log(`[T2 out] ${d.toString().trim()}`); });
p2.on('exit', (code, sig) => log(`[T2 exit] code=${code} signal=${sig}`));

await new Promise(r => setTimeout(r, 2000));
log(`[T2] alive=${p2alive}, pid=${p2.pid}, killed=${p2.killed}, exitCode=${p2.exitCode}`);

// Try sending data
const body = JSON.stringify({
	jsonrpc: '2.0', id: 1, method: 'initialize',
	params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 't', version: '1' } },
});
const msg = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
log(`[T2] writing ${msg.length} bytes to stdin...`);
const ok = p2.stdin!.write(msg);
log(`[T2] write returned: ${ok}`);

await new Promise(r => setTimeout(r, 3000));
log(`[T2] after 3s wait, alive=${p2alive}`);

p2.kill();
await new Promise(r => setTimeout(r, 500));
log('done');
process.exit(0);

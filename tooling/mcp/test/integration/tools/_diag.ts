/**
 * Diagnostic script — pinpoints where the hang occurs.
 * Run: bun tooling/mcp/test/integration/tools/_diag.ts
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createBunnerKbServer } from '../../../src/server';

const hermeticEnv = {
	BUNNER_KB_DB_NAME: 'bunner_test_hermetic',
	BUNNER_KB_DB_USER: 'test_user',
	BUNNER_KB_DB_PASSWORD: 'test_pw',
	BUNNER_KB_DB_HOST: 'localhost',
	BUNNER_KB_DB_PRIMARY_PORT: '1',
	BUNNER_KB_DB_REPLICA1_PORT: '2',
	BUNNER_KB_DB_REPLICA2_PORT: '3',
};

const timeout = (ms: number, label: string) =>
	new Promise((_, rej) => setTimeout(() => rej(new Error(`TIMEOUT: ${label} after ${ms}ms`)), ms));

async function main() {
	console.log('[1] creating server...');
	const { server } = createBunnerKbServer({ envSource: hermeticEnv });
	console.log('[2] server created');

	const [st, ct] = InMemoryTransport.createLinkedPair();
	console.log('[3] transport pair created');

	await Promise.race([server.connect(st), timeout(3000, 'server.connect')]);
	console.log('[4] server connected to transport');

	const client = new Client({ name: 'diag', version: '0.0.0' }, { capabilities: {} });
	await Promise.race([client.connect(ct), timeout(3000, 'client.connect')]);
	console.log('[5] client connected');

	console.log('[6] closing via harness pattern (client.close + server.close)...');
	await client.close();
	await server.close();
	console.log('[7] server+client closed');

	console.log('[8] checking for live handles...');
	await new Promise(r => setTimeout(r, 2000));
	console.log('[9] done — process should exit naturally');
}

main().catch(e => {
	console.error('FATAL:', e);
	process.exit(1);
});

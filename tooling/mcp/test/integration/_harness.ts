/**
 * Integration test harness for MCP tools.
 *
 * Provides three helpers:
 *  - `createIntegrationClient(options?)` — Server + InMemoryTransport + Client
 *  - `createHermeticEnvSource()`         — Fake env with ports 1/2/3 (connection refused, fast-fail)
 *  - `IS_REAL_DB`                        — True when BUNNER_KB_TEST_REAL_DB=1
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createBunnerKbServer } from '../../src/server';

/** Set when `BUNNER_KB_TEST_REAL_DB=1` to enable real-DB functional tests. */
export const IS_REAL_DB = Bun.env.BUNNER_KB_TEST_REAL_DB === '1';

/** Returns a hermetic env source using ports 1/2/3 that will ECONNREFUSED instantly. */
export function createHermeticEnvSource(): Record<string, string | undefined> {
	return {
		BUNNER_KB_DB_NAME: 'bunner_test_hermetic',
		BUNNER_KB_DB_USER: 'test_user',
		BUNNER_KB_DB_PASSWORD: 'test_pw',
		BUNNER_KB_DB_HOST: 'localhost',
		BUNNER_KB_DB_PRIMARY_PORT: '1',
		BUNNER_KB_DB_REPLICA1_PORT: '2',
		BUNNER_KB_DB_REPLICA2_PORT: '3',
	};
}

/** Returns an env source sourced from `process.env` (for real DB tests). */
export function createRealDbEnvSourceFromProcess(): Record<string, string | undefined> {
	return {
		BUNNER_KB_DB_NAME: process.env.BUNNER_KB_DB_NAME,
		BUNNER_KB_DB_USER: process.env.BUNNER_KB_DB_USER,
		BUNNER_KB_DB_PASSWORD: process.env.BUNNER_KB_DB_PASSWORD,
		BUNNER_KB_DB_HOST: process.env.BUNNER_KB_DB_HOST,
		BUNNER_KB_DB_PRIMARY_PORT: process.env.BUNNER_KB_DB_PRIMARY_PORT,
		BUNNER_KB_DB_REPLICA1_PORT: process.env.BUNNER_KB_DB_REPLICA1_PORT,
		BUNNER_KB_DB_REPLICA2_PORT: process.env.BUNNER_KB_DB_REPLICA2_PORT,
	};
}

/**
 * Create a fully-wired MCP Client ↔ Server pair using InMemoryTransport.
 *
 * - `envSource: {}`                 → readEnv throws immediately (init-failure tests)
 * - `envSource: createHermeticEnvSource()` → init succeeds, DB queries fail (argument tests)
 * - `envSource: undefined`          → uses `Bun.env` (real-DB tests)
 */
export async function createIntegrationClient(options?: {
	envSource?: Record<string, string | undefined>;
}) {
	const envSource = options?.envSource;
	const { server } = createBunnerKbServer(envSource ? { envSource } : undefined);
	const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();

	await server.connect(serverTransport);

	const client = new Client(
		{ name: 'bunner-mcp-integration-test', version: '0.0.0' },
		{ capabilities: {} },
	);
	await client.connect(clientTransport);

	const close = async () => {
		await client.close();
		await server.close();
	};

	return { client, close };
}

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createBunnerKbServer } from '../../src/server.ts';

export type EnvSource = Record<string, string | undefined>;

export const IS_REAL_DB = Bun.env.BUNNER_KB_TEST_REAL_DB === '1';

export function createHermeticEnvSource(): EnvSource {
  return {
    BUNNER_KB_DB: 'bunner_kb_test',
    BUNNER_KB_USER: 'test',
    BUNNER_KB_PASSWORD: '',
    // Use ports that should fail fast in most environments.
    BUNNER_KB_PRIMARY_PORT: '1',
    BUNNER_KB_REPLICA1_PORT: '2',
    BUNNER_KB_REPLICA2_PORT: '3',
  };
}

export function createRealDbEnvSourceFromProcess(): EnvSource {
  // Read-only snapshot (do not mutate Bun.env in tests).
  return {
    BUNNER_KB_DB: Bun.env.BUNNER_KB_DB,
    BUNNER_KB_USER: Bun.env.BUNNER_KB_USER,
    BUNNER_KB_PASSWORD: Bun.env.BUNNER_KB_PASSWORD,
    BUNNER_KB_PRIMARY_PORT: Bun.env.BUNNER_KB_PRIMARY_PORT,
    BUNNER_KB_REPLICA1_PORT: Bun.env.BUNNER_KB_REPLICA1_PORT,
    BUNNER_KB_REPLICA2_PORT: Bun.env.BUNNER_KB_REPLICA2_PORT,
  };
}

export async function createIntegrationClient(options?: { envSource?: EnvSource }) {
  const server = options?.envSource
    ? createBunnerKbServer({ envSource: options.envSource })
    : createBunnerKbServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const client = new Client(
    { name: 'bunner-mcp-integration-test', version: '0.0.0' },
    { capabilities: {} },
  );

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const close = async () => {
    // Closing one side also closes the linked other side.
    await clientTransport.close();
  };

  return { client, close };
}

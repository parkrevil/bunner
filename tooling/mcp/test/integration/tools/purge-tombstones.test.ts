import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'purge_tombstones';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with no args', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});

		it('returns error with valid args', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 7 });
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});
	});

	describe('argument exhaustion (hermetic)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() }));
		});
		afterAll(async () => await close());

		// ── olderThan (optional integer) ────────────────────
		it('olderThan: omitted', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('olderThan: 7', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 7 });
			expectWellFormed(res);
		});

		it('olderThan: 30', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 30 });
			expectWellFormed(res);
		});

		it('olderThan: 1', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 1 });
			expectWellFormed(res);
		});

		it('olderThan: 0', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 0 });
			expectWellFormed(res);
		});

		it('olderThan: -1 (negative)', async () => {
			const res = await safeCall(client, TOOL, { olderThan: -1 });
			expectWellFormed(res);
		});

		it('olderThan: 365', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 365 });
			expectWellFormed(res);
		});

		it('olderThan: 999999', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 999_999 });
			expectWellFormed(res);
		});

		it('olderThan: float', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 7.5 });
			expectWellFormed(res);
		});

		it('olderThan: string', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 'week' as any });
			expectWellFormed(res);
		});

		it('olderThan: null', async () => {
			const res = await safeCall(client, TOOL, { olderThan: null as any });
			expectWellFormed(res);
		});

		it('olderThan: boolean', async () => {
			const res = await safeCall(client, TOOL, { olderThan: true as any });
			expectWellFormed(res);
		});

		// ── workspaceId (optional string) ───────────────────
		it('workspaceId: omitted', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 7 });
			expectWellFormed(res);
		});

		it('workspaceId: valid string', async () => {
			const res = await safeCall(client, TOOL, { workspaceId: 'test-workspace' });
			expectWellFormed(res);
		});

		it('workspaceId: empty string', async () => {
			const res = await safeCall(client, TOOL, { workspaceId: '' });
			expectWellFormed(res);
		});

		it('workspaceId: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { workspaceId: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('workspaceId: unicode', async () => {
			const res = await safeCall(client, TOOL, { workspaceId: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('workspaceId: null', async () => {
			const res = await safeCall(client, TOOL, { workspaceId: null as any });
			expectWellFormed(res);
		});

		it('workspaceId: number', async () => {
			const res = await safeCall(client, TOOL, { workspaceId: 42 as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('both params valid', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 14, workspaceId: 'test' });
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 7, extra: 1 } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 'old', workspaceId: 42 } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns purge result', async () => {
			const res = await safeCall(client, TOOL, { olderThan: 365 });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('purgedEntities');
				expect(data).toHaveProperty('purgedEvents');
			}
		});

		it('purges with default olderThan', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});
	});
});

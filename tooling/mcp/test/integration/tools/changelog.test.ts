import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'changelog';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid args', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::test' });
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});

		it('returns error without args', async () => {
			const res = await safeCall(client, TOOL, {});
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

		// ── entityKey ───────────────────────────────────────
		it('entityKey: valid', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::core' });
			expectWellFormed(res);
		});

		it('entityKey: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('entityKey: empty string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '' });
			expectWellFormed(res);
		});

		it('entityKey: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('entityKey: unicode', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('entityKey: 10k chars', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.longString });
			expectWellFormed(res);
		});

		it('entityKey: XSS', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.xss });
			expectWellFormed(res);
		});

		it('entityKey: null byte', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.nullByte });
			expectWellFormed(res);
		});

		it('entityKey: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: null as any });
			expectWellFormed(res);
		});

		it('entityKey: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 42 as any });
			expectWellFormed(res);
		});

		it('entityKey: boolean', async () => {
			const res = await safeCall(client, TOOL, { entityKey: true as any });
			expectWellFormed(res);
		});

		// ── limit ───────────────────────────────────────────
		it('limit: 1 (min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 1 });
			expectWellFormed(res);
		});

		it('limit: 200 (max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 200 });
			expectWellFormed(res);
		});

		it('limit: 50 (default)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 50 });
			expectWellFormed(res);
		});

		it('limit: 0 (below min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 0 });
			expectWellFormed(res);
		});

		it('limit: 201 (above max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 201 });
			expectWellFormed(res);
		});

		it('limit: -1', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: -1 });
			expectWellFormed(res);
		});

		it('limit: float', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 7.7 });
			expectWellFormed(res);
		});

		it('limit: string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 'all' as any });
			expectWellFormed(res);
		});

		it('limit: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: null as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('all valid params', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::core', limit: 25 });
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', hack: 1 } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 99, limit: 'many' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns changelog for existing entity', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core', limit: 5 });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(Array.isArray(data)).toBe(true);
			}
		});

		it('returns empty changelog for non-existent entity', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '___nothing___', limit: 5 });
			expectWellFormed(res);
		});
	});
});

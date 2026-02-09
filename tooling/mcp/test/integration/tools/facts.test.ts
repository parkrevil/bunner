import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'facts';
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

		it('entityKey: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: null as any });
			expectWellFormed(res);
		});

		it('entityKey: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 42 as any });
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

		// ── factType ────────────────────────────────────────
		it('factType: export', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: 'export' });
			expectWellFormed(res);
		});

		it('factType: dependency', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: 'dependency' });
			expectWellFormed(res);
		});

		it('factType: config', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: 'config' });
			expectWellFormed(res);
		});

		it('factType: type_signature', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: 'type_signature' });
			expectWellFormed(res);
		});

		it('factType: empty string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: '' });
			expectWellFormed(res);
		});

		it('factType: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('factType: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', factType: 999 as any });
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

		it('limit: 0 (below min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 0 });
			expectWellFormed(res);
		});

		it('limit: 201 (above max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 201 });
			expectWellFormed(res);
		});

		it('limit: -1 (negative)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: -1 });
			expectWellFormed(res);
		});

		it('limit: float', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 3.14 });
			expectWellFormed(res);
		});

		it('limit: string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 'many' as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('all params valid', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::core', factType: 'export', limit: 25 });
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', __hack: 1 } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 42, factType: true, limit: 'abc' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns facts array for valid entity', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core', limit: 5 });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(Array.isArray(data)).toBe(true);
			}
		});
	});
});

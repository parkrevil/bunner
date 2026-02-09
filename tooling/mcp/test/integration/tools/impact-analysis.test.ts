import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, safeCall } from './_helpers';

const TOOL = 'impact_analysis';
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
			const res = await safeCall(client, TOOL, { entityKey: 'file::src/app.ts' });
			expectWellFormed(res);
		});

		it('entityKey: missing', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('entityKey: empty', async () => {
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

		// ── depth ───────────────────────────────────────────
		it('depth: default (omitted)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x' });
			expectWellFormed(res);
		});

		it('depth: 1 (min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 1 });
			expectWellFormed(res);
		});

		it('depth: 10 (max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 10 });
			expectWellFormed(res);
		});

		it('depth: 3 (default value)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 3 });
			expectWellFormed(res);
		});

		it('depth: 0 (below min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 0 });
			expectWellFormed(res);
		});

		it('depth: 11 (above max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 11 });
			expectWellFormed(res);
		});

		it('depth: -1 (negative)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: -1 });
			expectWellFormed(res);
		});

		it('depth: 5.5 (float)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 5.5 });
			expectWellFormed(res);
		});

		it('depth: string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 'deep' as any });
			expectWellFormed(res);
		});

		it('depth: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: null as any });
			expectWellFormed(res);
		});

		it('depth: 999999', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 999_999 });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('all valid params', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::core', depth: 5 });
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 3, extra: true } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 123, depth: 'abc' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns impact analysis structure', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core', depth: 2 });
			expectWellFormed(res);
		});

		it('returns result for non-existent entity', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '___nothing___' });
			expectWellFormed(res);
		});
	});
});

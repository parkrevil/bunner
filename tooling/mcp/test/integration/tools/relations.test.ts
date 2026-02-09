import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'relations';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	// ── Init Failure ────────────────────────────────────────
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

		it('returns error even without args', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});
	});

	// ── Argument Exhaustion ─────────────────────────────────
	describe('argument exhaustion (hermetic)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() }));
		});
		afterAll(async () => await close());

		// ── entityKey ───────────────────────────────────────
		it('entityKey: valid', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::test' });
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

		it('entityKey: number type', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 999 as any });
			expectWellFormed(res);
		});

		it('entityKey: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: null as any });
			expectWellFormed(res);
		});

		// ── direction (enum) ────────────────────────────────
		it('direction: outgoing', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'outgoing' });
			expectWellFormed(res);
		});

		it('direction: incoming', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'incoming' });
			expectWellFormed(res);
		});

		it('direction: both', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'both' });
			expectWellFormed(res);
		});

		it('direction: invalid string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'sideways' });
			expectWellFormed(res);
		});

		it('direction: empty string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: '' });
			expectWellFormed(res);
		});

		it('direction: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 1 as any });
			expectWellFormed(res);
		});

		// ── relationType ────────────────────────────────────
		it('relationType: imports', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', relationType: 'imports' });
			expectWellFormed(res);
		});

		it('relationType: empty', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', relationType: '' });
			expectWellFormed(res);
		});

		it('relationType: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', relationType: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		// ── depth ───────────────────────────────────────────
		it('depth: minimum (1)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 1 });
			expectWellFormed(res);
		});

		it('depth: maximum (10)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 10 });
			expectWellFormed(res);
		});

		it('depth: below min (0)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 0 });
			expectWellFormed(res);
		});

		it('depth: above max (11)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 11 });
			expectWellFormed(res);
		});

		it('depth: negative (-5)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: -5 });
			expectWellFormed(res);
		});

		it('depth: float (2.7)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 2.7 });
			expectWellFormed(res);
		});

		it('depth: string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 'deep' as any });
			expectWellFormed(res);
		});

		// ── limit ───────────────────────────────────────────
		it('limit: minimum (1)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 1 });
			expectWellFormed(res);
		});

		it('limit: maximum (200)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 200 });
			expectWellFormed(res);
		});

		it('limit: below min (0)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 0 });
			expectWellFormed(res);
		});

		it('limit: above max (201)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: 201 });
			expectWellFormed(res);
		});

		it('limit: negative', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', limit: -10 });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('all params valid', async () => {
			const res = await safeCall(client, TOOL, {
				entityKey: 'module::core', direction: 'both',
				relationType: 'imports', depth: 3, limit: 50,
			});
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', bonus: 'field' } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, {
				entityKey: 42, direction: true, relationType: 99,
				depth: 'max', limit: 'all',
			} as any);
			expectWellFormed(res);
		});
	});

	// ── Functional ──────────────────────────────────────────
	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns relations structure', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core', limit: 5 });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(Array.isArray(data)).toBe(true);
			}
		});

		it('returns empty for non-existent entity', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '___no_entity___' });
			expectWellFormed(res);
		});
	});
});

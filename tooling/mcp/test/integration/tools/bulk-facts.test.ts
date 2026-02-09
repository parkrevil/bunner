import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'bulk_facts';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid args', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::test'] });
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

		// ── entityKeys (required array) ─────────────────────
		it('entityKeys: single item', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::core'] });
			expectWellFormed(res);
		});

		it('entityKeys: multiple items', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::a', 'file::b', 'class::c'] });
			expectWellFormed(res);
		});

		it('entityKeys: 50 items (max)', async () => {
			const keys = Array.from({ length: 50 }, (_, i) => `module::item${i}`);
			const res = await safeCall(client, TOOL, { entityKeys: keys });
			expectWellFormed(res);
		});

		it('entityKeys: 51 items (above max)', async () => {
			const keys = Array.from({ length: 51 }, (_, i) => `module::item${i}`);
			const res = await safeCall(client, TOOL, { entityKeys: keys });
			expectWellFormed(res);
		});

		it('entityKeys: empty array', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [] });
			expectWellFormed(res);
		});

		it('entityKeys: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('entityKeys: array with empty strings', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['', ''] });
			expectWellFormed(res);
		});

		it('entityKeys: SQL injection strings', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.sqlInjection, ATTACK.sqlInjection] });
			expectWellFormed(res);
		});

		it('entityKeys: unicode strings', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.unicode] });
			expectWellFormed(res);
		});

		it('entityKeys: XSS strings', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.xss] });
			expectWellFormed(res);
		});

		it('entityKeys: 10k-char string', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.longString] });
			expectWellFormed(res);
		});

		it('entityKeys: null byte', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.nullByte] });
			expectWellFormed(res);
		});

		it('entityKeys: duplicates', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::a', 'module::a'] });
			expectWellFormed(res);
		});

		// ── Wrong types for entityKeys ──────────────────────
		it('entityKeys: string', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: 'module::test' as any });
			expectWellFormed(res);
		});

		it('entityKeys: number', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: 42 as any });
			expectWellFormed(res);
		});

		it('entityKeys: null', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: null as any });
			expectWellFormed(res);
		});

		it('entityKeys: boolean', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: false as any });
			expectWellFormed(res);
		});

		it('entityKeys: array of numbers', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [1, 2, 3] as any });
			expectWellFormed(res);
		});

		it('entityKeys: array of nulls', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [null, null] as any });
			expectWellFormed(res);
		});

		// ── factType (optional string) ──────────────────────
		it('factType: export', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: 'export' });
			expectWellFormed(res);
		});

		it('factType: dependency', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: 'dependency' });
			expectWellFormed(res);
		});

		it('factType: config', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: 'config' });
			expectWellFormed(res);
		});

		it('factType: empty string', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: '' });
			expectWellFormed(res);
		});

		it('factType: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('factType: null', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: null as any });
			expectWellFormed(res);
		});

		it('factType: number', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], factType: 42 as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('multiple keys + factType', async () => {
			const res = await safeCall(client, TOOL, {
				entityKeys: ['module::a', 'module::b'], factType: 'export',
			});
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], hack: true } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: 42, factType: false } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns bulk facts results', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::@bunner/core'] });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('results');
			}
		});

		it('returns results with factType filter', async () => {
			const res = await safeCall(client, TOOL, {
				entityKeys: ['module::@bunner/core'], factType: 'export',
			});
			expectWellFormed(res);
		});

		it('returns results for non-existent keys', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['___nope1___', '___nope2___'] });
			expectWellFormed(res);
		});
	});
});

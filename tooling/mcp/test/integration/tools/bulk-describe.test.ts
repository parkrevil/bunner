import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'bulk_describe';
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
			const res = await safeCall(client, TOOL, { entityKeys: ['module::a', 'module::b', 'file::c'] });
			expectWellFormed(res);
		});

		it('entityKeys: exactly 50 items (max)', async () => {
			const keys = Array.from({ length: 50 }, (_, i) => `module::item${i}`);
			const res = await safeCall(client, TOOL, { entityKeys: keys });
			expectWellFormed(res);
		});

		it('entityKeys: 51 items (above max)', async () => {
			const keys = Array.from({ length: 51 }, (_, i) => `module::item${i}`);
			const res = await safeCall(client, TOOL, { entityKeys: keys });
			expectWellFormed(res);
		});

		it('entityKeys: empty array (below minItems:1)', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [] });
			expectWellFormed(res);
		});

		it('entityKeys: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('entityKeys: array with empty strings', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['', '', ''] });
			expectWellFormed(res);
		});

		it('entityKeys: array with SQL injection', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.sqlInjection] });
			expectWellFormed(res);
		});

		it('entityKeys: array with unicode', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.unicode] });
			expectWellFormed(res);
		});

		it('entityKeys: array with XSS', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.xss] });
			expectWellFormed(res);
		});

		it('entityKeys: array with null byte strings', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.nullByte] });
			expectWellFormed(res);
		});

		it('entityKeys: array with 10k-char string', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [ATTACK.longString] });
			expectWellFormed(res);
		});

		it('entityKeys: duplicate keys', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::a', 'module::a', 'module::a'] });
			expectWellFormed(res);
		});

		it('entityKeys: mixed valid and attack strings', async () => {
			const res = await safeCall(client, TOOL, {
				entityKeys: ['module::core', ATTACK.sqlInjection, '', ATTACK.unicode, ATTACK.xss],
			});
			expectWellFormed(res);
		});

		// ── Wrong types for entityKeys ──────────────────────
		it('entityKeys: string (not array)', async () => {
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
			const res = await safeCall(client, TOOL, { entityKeys: true as any });
			expectWellFormed(res);
		});

		it('entityKeys: object', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: { key: 'val' } as any });
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

		it('entityKeys: nested arrays', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: [['a'], ['b']] as any });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['x'], extra: 1 } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns bulk describe results', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['module::@bunner/core'] });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('results');
			}
		});

		it('returns results for multiple keys', async () => {
			const res = await safeCall(client, TOOL, {
				entityKeys: ['module::@bunner/core', 'module::@bunner/common', '___nope___'],
			});
			expectWellFormed(res);
		});

		it('returns results for non-existent keys', async () => {
			const res = await safeCall(client, TOOL, { entityKeys: ['___nothing1___', '___nothing2___'] });
			expectWellFormed(res);
		});
	});
});

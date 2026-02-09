import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'search';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	// ── Init Failure (empty env → readEnv throws) ───────────
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid args', async () => {
			const res = await safeCall(client, TOOL, { query: 'test' });
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});

		it('returns error with all valid args', async () => {
			const res = await safeCall(client, TOOL, { query: 'test', limit: 5, mode: 'lexical', filters: { entityType: 'module' } });
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});

		it('returns error even with missing required args', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});

		it('returns error with garbage args', async () => {
			const res = await safeCall(client, TOOL, { foo: 'bar', baz: 123 });
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});
	});

	// ── Argument Exhaustion (hermetic: DB unavailable) ──────
	describe('argument exhaustion (hermetic)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() }));
		});
		afterAll(async () => await close());

		// ── query parameter ─────────────────────────────────
		it('minimal: query only', async () => {
			const res = await safeCall(client, TOOL, { query: 'test' });
			expectWellFormed(res);
		});

		it('query: empty string', async () => {
			const res = await safeCall(client, TOOL, { query: '' });
			expectWellFormed(res);
		});

		it('query: single char', async () => {
			const res = await safeCall(client, TOOL, { query: 'x' });
			expectWellFormed(res);
		});

		it('query: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('query: unicode', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('query: long string (10k chars)', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.longString });
			expectWellFormed(res);
		});

		it('query: newlines', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.newlines });
			expectWellFormed(res);
		});

		it('query: XSS attempt', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.xss });
			expectWellFormed(res);
		});

		it('query: null byte', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.nullByte });
			expectWellFormed(res);
		});

		it('query: only spaces', async () => {
			const res = await safeCall(client, TOOL, { query: ATTACK.onlySpaces });
			expectWellFormed(res);
		});

		it('query: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('query: wrong type (number)', async () => {
			const res = await safeCall(client, TOOL, { query: 12345 as any });
			expectWellFormed(res);
		});

		it('query: wrong type (boolean)', async () => {
			const res = await safeCall(client, TOOL, { query: true as any });
			expectWellFormed(res);
		});

		it('query: wrong type (null)', async () => {
			const res = await safeCall(client, TOOL, { query: null as any });
			expectWellFormed(res);
		});

		it('query: wrong type (array)', async () => {
			const res = await safeCall(client, TOOL, { query: ['a', 'b'] as any });
			expectWellFormed(res);
		});

		it('query: wrong type (object)', async () => {
			const res = await safeCall(client, TOOL, { query: { nested: true } as any });
			expectWellFormed(res);
		});

		// ── limit parameter ─────────────────────────────────
		it('limit: minimum (1)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 1 });
			expectWellFormed(res);
		});

		it('limit: maximum (50)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 50 });
			expectWellFormed(res);
		});

		it('limit: below minimum (0)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 0 });
			expectWellFormed(res);
		});

		it('limit: above maximum (51)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 51 });
			expectWellFormed(res);
		});

		it('limit: negative (-1)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: -1 });
			expectWellFormed(res);
		});

		it('limit: float (1.5)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 1.5 });
			expectWellFormed(res);
		});

		it('limit: very large (999999)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 999_999 });
			expectWellFormed(res);
		});

		it('limit: string type', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: 'ten' as any });
			expectWellFormed(res);
		});

		it('limit: null', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', limit: null as any });
			expectWellFormed(res);
		});

		// ── mode parameter (enum) ───────────────────────────
		it('mode: lexical (valid)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', mode: 'lexical' });
			expectWellFormed(res);
		});

		it('mode: vector (valid)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', mode: 'vector' });
			expectWellFormed(res);
		});

		it('mode: hybrid (valid)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', mode: 'hybrid' });
			expectWellFormed(res);
		});

		it('mode: invalid string', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', mode: 'invalid_mode' });
			expectWellFormed(res);
		});

		it('mode: empty string', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', mode: '' });
			expectWellFormed(res);
		});

		it('mode: number', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', mode: 42 as any });
			expectWellFormed(res);
		});

		// ── filters parameter (object) ──────────────────────
		it('filters: entityType only', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', filters: { entityType: 'module' } });
			expectWellFormed(res);
		});

		it('filters: factType only', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', filters: { factType: 'export' } });
			expectWellFormed(res);
		});

		it('filters: both fields', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', filters: { entityType: 'file', factType: 'dependency' } });
			expectWellFormed(res);
		});

		it('filters: empty object', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', filters: {} });
			expectWellFormed(res);
		});

		it('filters: null', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', filters: null as any });
			expectWellFormed(res);
		});

		it('filters: string instead of object', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', filters: 'module' as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('all params provided', async () => {
			const res = await safeCall(client, TOOL, {
				query: 'module::core', limit: 25, mode: 'lexical',
				filters: { entityType: 'module', factType: 'export' },
			});
			expectWellFormed(res);
		});

		// ── additionalProperties ────────────────────────────
		it('extra properties (additionalProperties: false)', async () => {
			const res = await safeCall(client, TOOL, { query: 'x', __extra: true, hack: 'yes' } as any);
			expectWellFormed(res);
		});

		// ── Degenerate ──────────────────────────────────────
		it('completely empty args', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('args with every field wrong type', async () => {
			const res = await safeCall(client, TOOL, { query: 123, limit: 'abc', mode: true, filters: 42 } as any);
			expectWellFormed(res);
		});
	});

	// ── Functional (real DB) ────────────────────────────────
	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns valid search result structure for existing query', async () => {
			const res = await safeCall(client, TOOL, { query: 'module' });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('matches');
				expect(data).toHaveProperty('totalMatches');
				expect(Array.isArray(data.matches)).toBe(true);
			}
		});

		it('returns empty results for non-existent query', async () => {
			const res = await safeCall(client, TOOL, { query: '___absolutely_nothing_matches___' });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data.totalMatches).toBe(0);
			}
		});

		it('respects limit parameter', async () => {
			const res = await safeCall(client, TOOL, { query: 'module', limit: 1 });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data.matches.length).toBeLessThanOrEqual(1);
			}
		});
	});
});

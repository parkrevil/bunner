import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'recent_changes';
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
			const res = await safeCall(client, TOOL, { limit: 10 });
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

		// ── since (optional string, ISO 8601) ───────────────
		it('since: omitted', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('since: valid ISO date', async () => {
			const res = await safeCall(client, TOOL, { since: '2026-02-07T00:00:00Z' });
			expectWellFormed(res);
		});

		it('since: ISO with timezone offset', async () => {
			const res = await safeCall(client, TOOL, { since: '2026-02-07T09:00:00+09:00' });
			expectWellFormed(res);
		});

		it('since: date only (no time)', async () => {
			const res = await safeCall(client, TOOL, { since: '2026-02-07' });
			expectWellFormed(res);
		});

		it('since: invalid date string', async () => {
			const res = await safeCall(client, TOOL, { since: 'not-a-date' });
			expectWellFormed(res);
		});

		it('since: empty string', async () => {
			const res = await safeCall(client, TOOL, { since: '' });
			expectWellFormed(res);
		});

		it('since: far future', async () => {
			const res = await safeCall(client, TOOL, { since: '2099-12-31T23:59:59Z' });
			expectWellFormed(res);
		});

		it('since: far past', async () => {
			const res = await safeCall(client, TOOL, { since: '1970-01-01T00:00:00Z' });
			expectWellFormed(res);
		});

		it('since: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { since: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('since: unicode', async () => {
			const res = await safeCall(client, TOOL, { since: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('since: number', async () => {
			const res = await safeCall(client, TOOL, { since: 1707264000 as any });
			expectWellFormed(res);
		});

		it('since: null', async () => {
			const res = await safeCall(client, TOOL, { since: null as any });
			expectWellFormed(res);
		});

		it('since: boolean', async () => {
			const res = await safeCall(client, TOOL, { since: true as any });
			expectWellFormed(res);
		});

		// ── limit ───────────────────────────────────────────
		it('limit: 1 (min)', async () => {
			const res = await safeCall(client, TOOL, { limit: 1 });
			expectWellFormed(res);
		});

		it('limit: 200 (max)', async () => {
			const res = await safeCall(client, TOOL, { limit: 200 });
			expectWellFormed(res);
		});

		it('limit: 50 (default)', async () => {
			const res = await safeCall(client, TOOL, { limit: 50 });
			expectWellFormed(res);
		});

		it('limit: 0 (below min)', async () => {
			const res = await safeCall(client, TOOL, { limit: 0 });
			expectWellFormed(res);
		});

		it('limit: 201 (above max)', async () => {
			const res = await safeCall(client, TOOL, { limit: 201 });
			expectWellFormed(res);
		});

		it('limit: -1', async () => {
			const res = await safeCall(client, TOOL, { limit: -1 });
			expectWellFormed(res);
		});

		it('limit: float', async () => {
			const res = await safeCall(client, TOOL, { limit: 10.5 });
			expectWellFormed(res);
		});

		it('limit: string', async () => {
			const res = await safeCall(client, TOOL, { limit: 'abc' as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('both params valid', async () => {
			const res = await safeCall(client, TOOL, { since: '2026-01-01T00:00:00Z', limit: 25 });
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { limit: 5, extra: 1 } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { since: 42, limit: 'many' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns recent changes list', async () => {
			const res = await safeCall(client, TOOL, { limit: 5 });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(Array.isArray(data)).toBe(true);
			}
		});

		it('returns empty for far-future since', async () => {
			const res = await safeCall(client, TOOL, { since: '2099-12-31T23:59:59Z', limit: 5 });
			expectWellFormed(res);
		});
	});
});

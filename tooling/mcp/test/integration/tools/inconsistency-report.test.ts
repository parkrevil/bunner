import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'inconsistency_report';
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

		it('returns error with valid scope', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full' });
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

		// ── scope (enum, optional) ──────────────────────────
		it('scope: omitted (uses default)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('scope: structural', async () => {
			const res = await safeCall(client, TOOL, { scope: 'structural' });
			expectWellFormed(res);
		});

		it('scope: semantic', async () => {
			const res = await safeCall(client, TOOL, { scope: 'semantic' });
			expectWellFormed(res);
		});

		it('scope: full', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full' });
			expectWellFormed(res);
		});

		it('scope: invalid string', async () => {
			const res = await safeCall(client, TOOL, { scope: 'everything' });
			expectWellFormed(res);
		});

		it('scope: empty string', async () => {
			const res = await safeCall(client, TOOL, { scope: '' });
			expectWellFormed(res);
		});

		it('scope: number', async () => {
			const res = await safeCall(client, TOOL, { scope: 1 as any });
			expectWellFormed(res);
		});

		it('scope: boolean', async () => {
			const res = await safeCall(client, TOOL, { scope: true as any });
			expectWellFormed(res);
		});

		it('scope: null', async () => {
			const res = await safeCall(client, TOOL, { scope: null as any });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full', extra: 'data' } as any);
			expectWellFormed(res);
		});

		it('only extra properties', async () => {
			const res = await safeCall(client, TOOL, { foo: 'bar' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns report with scope=full', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full' });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('scope');
				expect(data).toHaveProperty('issues');
				expect(data).toHaveProperty('totalIssues');
			}
		});

		it('returns report with scope=structural', async () => {
			const res = await safeCall(client, TOOL, { scope: 'structural' });
			expectWellFormed(res);
		});

		it('returns report with no args (default)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});
	});
});

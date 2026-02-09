import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'sync';
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
			const res = await safeCall(client, TOOL, { scope: 'changed', dryRun: true });
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
		it('scope: omitted', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('scope: full', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full' });
			expectWellFormed(res);
		});

		it('scope: changed', async () => {
			const res = await safeCall(client, TOOL, { scope: 'changed' });
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

		it('scope: null', async () => {
			const res = await safeCall(client, TOOL, { scope: null as any });
			expectWellFormed(res);
		});

		// ── dryRun (boolean, optional) ──────────────────────
		it('dryRun: true', async () => {
			const res = await safeCall(client, TOOL, { dryRun: true });
			expectWellFormed(res);
		});

		it('dryRun: false', async () => {
			const res = await safeCall(client, TOOL, { dryRun: false });
			expectWellFormed(res);
		});

		it('dryRun: string "true"', async () => {
			const res = await safeCall(client, TOOL, { dryRun: 'true' as any });
			expectWellFormed(res);
		});

		it('dryRun: string "false"', async () => {
			const res = await safeCall(client, TOOL, { dryRun: 'false' as any });
			expectWellFormed(res);
		});

		it('dryRun: number 1', async () => {
			const res = await safeCall(client, TOOL, { dryRun: 1 as any });
			expectWellFormed(res);
		});

		it('dryRun: number 0', async () => {
			const res = await safeCall(client, TOOL, { dryRun: 0 as any });
			expectWellFormed(res);
		});

		it('dryRun: null', async () => {
			const res = await safeCall(client, TOOL, { dryRun: null as any });
			expectWellFormed(res);
		});

		it('dryRun: string', async () => {
			const res = await safeCall(client, TOOL, { dryRun: 'yes' as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('scope=full, dryRun=true', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full', dryRun: true });
			expectWellFormed(res);
		});

		it('scope=changed, dryRun=false', async () => {
			const res = await safeCall(client, TOOL, { scope: 'changed', dryRun: false });
			expectWellFormed(res);
		});

		it('scope=full, dryRun=false', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full', dryRun: false });
			expectWellFormed(res);
		});

		it('scope=changed, dryRun=true', async () => {
			const res = await safeCall(client, TOOL, { scope: 'changed', dryRun: true });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { scope: 'full', extra: 1 } as any);
			expectWellFormed(res);
		});

		it('only extra properties', async () => {
			const res = await safeCall(client, TOOL, { hack: true } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { scope: 42, dryRun: 'yes' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('dryRun=true returns files list', async () => {
			const res = await safeCall(client, TOOL, { scope: 'changed', dryRun: true });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('filesQueued');
				expect(data).toHaveProperty('trigger');
			}
		});

		it('scope=changed triggers sync', async () => {
			const res = await safeCall(client, TOOL, { scope: 'changed' });
			expectWellFormed(res);
		});
	});
});

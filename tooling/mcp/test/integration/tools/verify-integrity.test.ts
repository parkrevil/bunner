import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'verify_integrity';
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

		it('returns error with valid level', async () => {
			const res = await safeCall(client, TOOL, { level: 'full' });
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

		// ── level (enum, optional) ──────────────────────────
		it('level: omitted (default)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('level: structural', async () => {
			const res = await safeCall(client, TOOL, { level: 'structural' });
			expectWellFormed(res);
		});

		it('level: semantic', async () => {
			const res = await safeCall(client, TOOL, { level: 'semantic' });
			expectWellFormed(res);
		});

		it('level: full', async () => {
			const res = await safeCall(client, TOOL, { level: 'full' });
			expectWellFormed(res);
		});

		it('level: invalid string', async () => {
			const res = await safeCall(client, TOOL, { level: 'everything' });
			expectWellFormed(res);
		});

		it('level: empty string', async () => {
			const res = await safeCall(client, TOOL, { level: '' });
			expectWellFormed(res);
		});

		it('level: number', async () => {
			const res = await safeCall(client, TOOL, { level: 3 as any });
			expectWellFormed(res);
		});

		it('level: boolean', async () => {
			const res = await safeCall(client, TOOL, { level: true as any });
			expectWellFormed(res);
		});

		it('level: null', async () => {
			const res = await safeCall(client, TOOL, { level: null as any });
			expectWellFormed(res);
		});

		it('level: array', async () => {
			const res = await safeCall(client, TOOL, { level: ['structural', 'semantic'] as any });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { level: 'full', extra: true } as any);
			expectWellFormed(res);
		});

		it('only extra properties', async () => {
			const res = await safeCall(client, TOOL, { garbage: 123 } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns integrity result with level=full', async () => {
			const res = await safeCall(client, TOOL, { level: 'full' });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('level');
				expect(data).toHaveProperty('issues');
				expect(data).toHaveProperty('totalIssues');
				expect(data).toHaveProperty('checkedAt');
			}
		});

		it('returns result with level=structural', async () => {
			const res = await safeCall(client, TOOL, { level: 'structural' });
			expectWellFormed(res);
		});

		it('returns result with level=semantic', async () => {
			const res = await safeCall(client, TOOL, { level: 'semantic' });
			expectWellFormed(res);
		});

		it('returns result with default level', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});
	});
});

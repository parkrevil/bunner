import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'find_orphans';
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

		it('returns error with valid entityType', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'module' });
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

		// ── entityType (optional string) ────────────────────
		it('entityType: omitted', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('entityType: module', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'module' });
			expectWellFormed(res);
		});

		it('entityType: file', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'file' });
			expectWellFormed(res);
		});

		it('entityType: class', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'class' });
			expectWellFormed(res);
		});

		it('entityType: function', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'function' });
			expectWellFormed(res);
		});

		it('entityType: spec', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'spec' });
			expectWellFormed(res);
		});

		it('entityType: invalid string', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'banana' });
			expectWellFormed(res);
		});

		it('entityType: empty string', async () => {
			const res = await safeCall(client, TOOL, { entityType: '' });
			expectWellFormed(res);
		});

		it('entityType: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { entityType: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('entityType: unicode', async () => {
			const res = await safeCall(client, TOOL, { entityType: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('entityType: number', async () => {
			const res = await safeCall(client, TOOL, { entityType: 42 as any });
			expectWellFormed(res);
		});

		it('entityType: null', async () => {
			const res = await safeCall(client, TOOL, { entityType: null as any });
			expectWellFormed(res);
		});

		it('entityType: boolean', async () => {
			const res = await safeCall(client, TOOL, { entityType: false as any });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'module', extra: 1 } as any);
			expectWellFormed(res);
		});

		it('only extra properties', async () => {
			const res = await safeCall(client, TOOL, { garbage: true } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns orphans list with no filter', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data).toHaveProperty('orphans');
				expect(data).toHaveProperty('totalOrphans');
			}
		});

		it('returns orphans for specific type', async () => {
			const res = await safeCall(client, TOOL, { entityType: 'module' });
			expectWellFormed(res);
		});
	});
});

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { expectWellFormed, isError, safeCall } from './_helpers';

const TOOL = 'evidence';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid relationId', async () => {
			const res = await safeCall(client, TOOL, { relationId: 1 });
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

		// ── relationId ──────────────────────────────────────
		it('relationId: valid (1)', async () => {
			const res = await safeCall(client, TOOL, { relationId: 1 });
			expectWellFormed(res);
		});

		it('relationId: large number', async () => {
			const res = await safeCall(client, TOOL, { relationId: 999_999 });
			expectWellFormed(res);
		});

		it('relationId: Number.MAX_SAFE_INTEGER', async () => {
			const res = await safeCall(client, TOOL, { relationId: Number.MAX_SAFE_INTEGER });
			expectWellFormed(res);
		});

		it('relationId: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('relationId: 0 (below min:1)', async () => {
			const res = await safeCall(client, TOOL, { relationId: 0 });
			expectWellFormed(res);
		});

		it('relationId: negative (-1)', async () => {
			const res = await safeCall(client, TOOL, { relationId: -1 });
			expectWellFormed(res);
		});

		it('relationId: float (1.5)', async () => {
			const res = await safeCall(client, TOOL, { relationId: 1.5 });
			expectWellFormed(res);
		});

		it('relationId: string', async () => {
			const res = await safeCall(client, TOOL, { relationId: 'abc' as any });
			expectWellFormed(res);
		});

		it('relationId: null', async () => {
			const res = await safeCall(client, TOOL, { relationId: null as any });
			expectWellFormed(res);
		});

		it('relationId: boolean', async () => {
			const res = await safeCall(client, TOOL, { relationId: true as any });
			expectWellFormed(res);
		});

		it('relationId: object', async () => {
			const res = await safeCall(client, TOOL, { relationId: { id: 1 } as any });
			expectWellFormed(res);
		});

		it('relationId: array', async () => {
			const res = await safeCall(client, TOOL, { relationId: [1, 2] as any });
			expectWellFormed(res);
		});

		it('relationId: NaN', async () => {
			const res = await safeCall(client, TOOL, { relationId: NaN as any });
			expectWellFormed(res);
		});

		it('relationId: Infinity', async () => {
			const res = await safeCall(client, TOOL, { relationId: Infinity as any });
			expectWellFormed(res);
		});

		// ── additionalProperties ────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { relationId: 1, extra: 'hack' } as any);
			expectWellFormed(res);
		});

		it('all wrong', async () => {
			const res = await safeCall(client, TOOL, { relationId: 'nope', foo: true } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns evidence structure for valid relation', async () => {
			const res = await safeCall(client, TOOL, { relationId: 1 });
			expectWellFormed(res);
		});

		it('returns empty evidence for non-existent relation', async () => {
			const res = await safeCall(client, TOOL, { relationId: 999_999_999 });
			expectWellFormed(res);
		});
	});
});

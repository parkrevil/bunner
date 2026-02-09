import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, safeCall } from './_helpers';

const TOOL = 'dependency_graph';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
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
	});

	describe('argument exhaustion (hermetic)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() }));
		});
		afterAll(async () => await close());

		// ── entityKey ───────────────────────────────────────
		it('entityKey: valid', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::core' });
			expectWellFormed(res);
		});

		it('entityKey: missing', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('entityKey: empty', async () => {
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

		it('entityKey: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: null as any });
			expectWellFormed(res);
		});

		it('entityKey: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 777 as any });
			expectWellFormed(res);
		});

		// ── direction (enum) ────────────────────────────────
		it('direction: upstream', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'upstream' });
			expectWellFormed(res);
		});

		it('direction: downstream', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'downstream' });
			expectWellFormed(res);
		});

		it('direction: both', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'both' });
			expectWellFormed(res);
		});

		it('direction: invalid', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 'sideways' });
			expectWellFormed(res);
		});

		it('direction: empty', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: '' });
			expectWellFormed(res);
		});

		it('direction: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: 3 as any });
			expectWellFormed(res);
		});

		it('direction: boolean', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', direction: true as any });
			expectWellFormed(res);
		});

		// ── depth ───────────────────────────────────────────
		it('depth: 1 (min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 1 });
			expectWellFormed(res);
		});

		it('depth: 10 (max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 10 });
			expectWellFormed(res);
		});

		it('depth: 3 (default)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 3 });
			expectWellFormed(res);
		});

		it('depth: 0 (below min)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 0 });
			expectWellFormed(res);
		});

		it('depth: 11 (above max)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 11 });
			expectWellFormed(res);
		});

		it('depth: -1 (negative)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: -1 });
			expectWellFormed(res);
		});

		it('depth: float', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 3.7 });
			expectWellFormed(res);
		});

		it('depth: string', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', depth: 'max' as any });
			expectWellFormed(res);
		});

		// ── Combinatorial ───────────────────────────────────
		it('all valid params', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::core', direction: 'upstream', depth: 5 });
			expectWellFormed(res);
		});

		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', hack: 1 } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 0, direction: 42, depth: 'abc' } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns dependency graph structure', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core' });
			expectWellFormed(res);
		});
	});
});

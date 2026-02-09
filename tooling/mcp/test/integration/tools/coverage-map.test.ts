import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, safeCall } from './_helpers';

const TOOL = 'coverage_map';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid args', async () => {
			const res = await safeCall(client, TOOL, { specKey: 'spec::di.spec' });
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

		// ── specKey ─────────────────────────────────────────
		it('specKey: valid spec format', async () => {
			const res = await safeCall(client, TOOL, { specKey: 'spec::di.spec' });
			expectWellFormed(res);
		});

		it('specKey: pipeline spec', async () => {
			const res = await safeCall(client, TOOL, { specKey: 'spec::pipeline.spec' });
			expectWellFormed(res);
		});

		it('specKey: single char', async () => {
			const res = await safeCall(client, TOOL, { specKey: 'x' });
			expectWellFormed(res);
		});

		it('specKey: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('specKey: empty string', async () => {
			const res = await safeCall(client, TOOL, { specKey: '' });
			expectWellFormed(res);
		});

		it('specKey: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('specKey: unicode', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('specKey: 10k chars', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.longString });
			expectWellFormed(res);
		});

		it('specKey: XSS', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.xss });
			expectWellFormed(res);
		});

		it('specKey: null byte', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.nullByte });
			expectWellFormed(res);
		});

		it('specKey: newlines', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.newlines });
			expectWellFormed(res);
		});

		it('specKey: only spaces', async () => {
			const res = await safeCall(client, TOOL, { specKey: ATTACK.onlySpaces });
			expectWellFormed(res);
		});

		// ── Wrong types ─────────────────────────────────────
		it('specKey: number', async () => {
			const res = await safeCall(client, TOOL, { specKey: 42 as any });
			expectWellFormed(res);
		});

		it('specKey: boolean', async () => {
			const res = await safeCall(client, TOOL, { specKey: true as any });
			expectWellFormed(res);
		});

		it('specKey: null', async () => {
			const res = await safeCall(client, TOOL, { specKey: null as any });
			expectWellFormed(res);
		});

		it('specKey: array', async () => {
			const res = await safeCall(client, TOOL, { specKey: ['spec::a'] as any });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { specKey: 'spec::a', extra: 1 } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns coverage map structure', async () => {
			const res = await safeCall(client, TOOL, { specKey: 'spec::di.spec' });
			expectWellFormed(res);
		});

		it('returns result for non-existent spec', async () => {
			const res = await safeCall(client, TOOL, { specKey: '___no_spec___' });
			expectWellFormed(res);
		});
	});
});

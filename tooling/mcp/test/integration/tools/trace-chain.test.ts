import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, safeCall } from './_helpers';

const TOOL = 'trace_chain';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid args', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'module::a', toKey: 'module::b' });
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

		// ── fromKey ─────────────────────────────────────────
		it('fromKey: valid', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'module::a', toKey: 'module::b' });
			expectWellFormed(res);
		});

		it('fromKey: missing', async () => {
			const res = await safeCall(client, TOOL, { toKey: 'module::b' });
			expectWellFormed(res);
		});

		it('fromKey: empty', async () => {
			const res = await safeCall(client, TOOL, { fromKey: '', toKey: 'module::b' });
			expectWellFormed(res);
		});

		it('fromKey: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { fromKey: ATTACK.sqlInjection, toKey: 'x' });
			expectWellFormed(res);
		});

		it('fromKey: unicode', async () => {
			const res = await safeCall(client, TOOL, { fromKey: ATTACK.unicode, toKey: 'x' });
			expectWellFormed(res);
		});

		it('fromKey: 10k chars', async () => {
			const res = await safeCall(client, TOOL, { fromKey: ATTACK.longString, toKey: 'x' });
			expectWellFormed(res);
		});

		it('fromKey: null', async () => {
			const res = await safeCall(client, TOOL, { fromKey: null as any, toKey: 'x' });
			expectWellFormed(res);
		});

		it('fromKey: number', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 42 as any, toKey: 'x' });
			expectWellFormed(res);
		});

		// ── toKey ───────────────────────────────────────────
		it('toKey: missing', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'module::a' });
			expectWellFormed(res);
		});

		it('toKey: empty', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'x', toKey: '' });
			expectWellFormed(res);
		});

		it('toKey: SQL injection', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'x', toKey: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('toKey: unicode', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'x', toKey: ATTACK.unicode });
			expectWellFormed(res);
		});

		it('toKey: 10k chars', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'x', toKey: ATTACK.longString });
			expectWellFormed(res);
		});

		it('toKey: null', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'x', toKey: null as any });
			expectWellFormed(res);
		});

		// ── Both keys ───────────────────────────────────────
		it('both missing', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
		});

		it('both empty', async () => {
			const res = await safeCall(client, TOOL, { fromKey: '', toKey: '' });
			expectWellFormed(res);
		});

		it('same key for both', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'module::x', toKey: 'module::x' });
			expectWellFormed(res);
		});

		it('both SQL injection', async () => {
			const res = await safeCall(client, TOOL, { fromKey: ATTACK.sqlInjection, toKey: ATTACK.sqlInjection });
			expectWellFormed(res);
		});

		it('both XSS', async () => {
			const res = await safeCall(client, TOOL, { fromKey: ATTACK.xss, toKey: ATTACK.xss });
			expectWellFormed(res);
		});

		it('both null byte', async () => {
			const res = await safeCall(client, TOOL, { fromKey: ATTACK.nullByte, toKey: ATTACK.nullByte });
			expectWellFormed(res);
		});

		// ── Extra ───────────────────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'a', toKey: 'b', extra: 1 } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 123, toKey: true } as any);
			expectWellFormed(res);
		});
	});

	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns trace chain structure', async () => {
			const res = await safeCall(client, TOOL, { fromKey: 'module::@bunner/core', toKey: 'module::@bunner/common' });
			expectWellFormed(res);
		});

		it('returns result for disconnected entities', async () => {
			const res = await safeCall(client, TOOL, { fromKey: '___nope_a___', toKey: '___nope_b___' });
			expectWellFormed(res);
		});
	});
});

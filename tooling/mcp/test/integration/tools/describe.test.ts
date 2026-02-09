import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createHermeticEnvSource, createIntegrationClient, IS_REAL_DB } from '../_harness';
import { ATTACK, expectWellFormed, isError, parseJson, safeCall } from './_helpers';

const TOOL = 'describe';
const describeReal = IS_REAL_DB ? describe : describe.skip;

describe(`mcp/tools/${TOOL}`, () => {
	// ── Init Failure ────────────────────────────────────────
	describe('init failure (empty env)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: {} }));
		});
		afterAll(async () => await close());

		it('returns error with valid entityKey', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::test' });
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});

		it('returns error even without args', async () => {
			const res = await safeCall(client, TOOL, {});
			expectWellFormed(res);
			expect(isError(res)).toBe(true);
		});
	});

	// ── Argument Exhaustion ─────────────────────────────────
	describe('argument exhaustion (hermetic)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient({ envSource: createHermeticEnvSource() }));
		});
		afterAll(async () => await close());

		// ── entityKey: valid formats ────────────────────────
		it('entityKey: standard format (type::name)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core' });
			expectWellFormed(res);
		});

		it('entityKey: file format', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'file::src/app.ts' });
			expectWellFormed(res);
		});

		it('entityKey: single char', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x' });
			expectWellFormed(res);
		});

		it('entityKey: just double colon', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '::' });
			expectWellFormed(res);
		});

		it('entityKey: triple colon', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.doubleColon });
			expectWellFormed(res);
		});

		// ── entityKey: edge cases ───────────────────────────
		it('entityKey: empty string (violates minLength:1)', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '' });
			expectWellFormed(res);
		});

		it('entityKey: missing (required)', async () => {
			const res = await safeCall(client, TOOL, {});
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

		it('entityKey: XSS', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.xss });
			expectWellFormed(res);
		});

		it('entityKey: newlines', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.newlines });
			expectWellFormed(res);
		});

		it('entityKey: null byte', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.nullByte });
			expectWellFormed(res);
		});

		it('entityKey: backslash path', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.backslash });
			expectWellFormed(res);
		});

		it('entityKey: only spaces', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ATTACK.onlySpaces });
			expectWellFormed(res);
		});

		// ── entityKey: wrong types ──────────────────────────
		it('entityKey: number', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 42 as any });
			expectWellFormed(res);
		});

		it('entityKey: boolean', async () => {
			const res = await safeCall(client, TOOL, { entityKey: false as any });
			expectWellFormed(res);
		});

		it('entityKey: null', async () => {
			const res = await safeCall(client, TOOL, { entityKey: null as any });
			expectWellFormed(res);
		});

		it('entityKey: array', async () => {
			const res = await safeCall(client, TOOL, { entityKey: ['a'] as any });
			expectWellFormed(res);
		});

		it('entityKey: object', async () => {
			const res = await safeCall(client, TOOL, { entityKey: { key: 'val' } as any });
			expectWellFormed(res);
		});

		// ── additionalProperties ────────────────────────────
		it('extra properties', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'x', extra: true } as any);
			expectWellFormed(res);
		});

		it('all wrong types', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 123, extra: 'yes' } as any);
			expectWellFormed(res);
		});
	});

	// ── Functional ──────────────────────────────────────────
	describeReal('functional (real DB)', () => {
		let client: any, close: () => Promise<void>;
		beforeAll(async () => {
			({ client, close } = await createIntegrationClient());
		});
		afterAll(async () => await close());

		it('returns null entity for non-existent key', async () => {
			const res = await safeCall(client, TOOL, { entityKey: '___no_such_entity___' });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				expect(data?.entity).toBeNull();
			}
		});

		it('returns describe result structure for valid key', async () => {
			const res = await safeCall(client, TOOL, { entityKey: 'module::@bunner/core' });
			expectWellFormed(res);
			if (!isError(res)) {
				const data = parseJson(res) as any;
				if (data?.entity) {
					expect(data.entity).toHaveProperty('key');
					expect(data.entity).toHaveProperty('type');
					expect(data).toHaveProperty('sources');
					expect(data).toHaveProperty('facts');
				}
			}
		});
	});
});

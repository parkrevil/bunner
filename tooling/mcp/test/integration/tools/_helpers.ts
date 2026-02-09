import { expect } from 'bun:test';

// ── Types ────────────────────────────────────────────────────

export type ToolResponse = {
	content: Array<{ type: string; text?: string; [k: string]: unknown }>;
	isError?: boolean;
	[k: string]: unknown;
};

// ── Safe Call ────────────────────────────────────────────────

/** Wraps client.callTool so protocol-level errors become ToolResponse instead of thrown. */
export async function safeCall(
	client: { callTool: (r: { name: string; arguments: Record<string, unknown> }) => Promise<unknown> },
	name: string,
	args: Record<string, unknown> = {},
): Promise<ToolResponse> {
	try {
		return (await client.callTool({ name, arguments: args })) as ToolResponse;
	} catch (e: unknown) {
		return {
			content: [{ type: 'text', text: `[thrown] ${e instanceof Error ? e.message : String(e)}` }],
			isError: true,
		};
	}
}

// ── Extractors ───────────────────────────────────────────────

export function textOf(res: ToolResponse): string {
	const c = res.content?.[0];
	return c && typeof c.text === 'string' ? c.text : '';
}

export function isError(res: ToolResponse): boolean {
	return res.isError === true;
}

export function parseJson(res: ToolResponse): unknown {
	try {
		return JSON.parse(textOf(res));
	} catch {
		return null;
	}
}

// ── Assertions ───────────────────────────────────────────────

/** Response exists with non-empty content array. */
export function expectWellFormed(res: ToolResponse) {
	expect(res).toBeDefined();
	expect(res.content).toBeArray();
	expect(res.content.length).toBeGreaterThan(0);
}

/** Error response that mentions the tool name. */
export function expectErrorFor(res: ToolResponse, tool: string) {
	expectWellFormed(res);
	expect(isError(res)).toBe(true);
	expect(textOf(res).toLowerCase()).toContain(tool.toLowerCase());
}

/** Successful JSON response — returns the parsed payload. */
export function expectSuccess(res: ToolResponse): unknown {
	expectWellFormed(res);
	expect(isError(res)).toBe(false);
	const data = parseJson(res);
	expect(data).not.toBeNull();
	return data;
}

// ── Attack / Edge-case payloads ──────────────────────────────

export const ATTACK = {
	sqlInjection: "'; DROP TABLE entity; --",
	unicode: '한글テスト🎉émojis',
	longString: 'x'.repeat(10_000),
	newlines: 'line1\nline2\r\nline3',
	xss: '<script>alert(1)</script>&foo=bar',
	nullByte: 'hello\0world',
	backslash: 'path\\to\\file',
	doubleColon: 'type::name::extra',
	onlySpaces: '   ',
};

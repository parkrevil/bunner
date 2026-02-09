import type { DbLike } from '../db';

export type Id = number;

export type RepoContext = {
	readonly db: DbLike;
};

export function clampPayloadText(text: string): string {
	const trimmed = text.trim();
	if (trimmed.length <= 4000) return trimmed;
	return `${trimmed.slice(0, 3990)}…`;
}

export function coerceId(value: unknown, context: string): number {
	if (typeof value === 'number') return value;
	if (typeof value === 'bigint') {
		const max = BigInt(Number.MAX_SAFE_INTEGER);
		const min = BigInt(Number.MIN_SAFE_INTEGER);
		if (value <= max && value >= min) return Number(value);
		throw new Error(`Returned id is out of JS safe integer range (${context})`);
	}
	if (typeof value === 'string') {
		if (/^\d+$/.test(value)) {
			const n = Number(value);
			if (Number.isSafeInteger(n)) return n;
		}
		throw new Error(`Returned id is not a safe integer string (${context})`);
	}
	throw new Error(`Returned id has unexpected type (${context})`);
}

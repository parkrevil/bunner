/**
 * Database Layer — §2.1 PostgreSQL Connection
 *
 * Drizzle(Bun SQL) DB/Tx를 그대로 사용한다.
 * - 풀 설정: max, idleTimeout, connectionTimeout
 * - 트랜잭션: drizzle db.transaction() 기반
 * - bigint 등 값 정규화는 **응답 직전**(server.ts)에서 수행
 *
 * @see MCP_PLAN §2.1, §3.5
 */

import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL as BunSql } from 'bun';
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import type { SQL as BunSqlClient } from 'bun';
import type { SQL as DrizzleSql } from 'drizzle-orm';

import * as schema from '../drizzle/schema';

// ── Types ────────────────────────────────────────────────────
export type Db = BunSQLDatabase<typeof schema> & {
	$client: BunSqlClient;
	close: (options?: { timeout?: number }) => Promise<void>;
};

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type DbLike = Db | Tx;

export function coerceRows(result: unknown): unknown[] {
	const maybeRows = (result as { rows?: unknown[] } | null | undefined)?.rows;
	if (Array.isArray(maybeRows)) return maybeRows;
	if (Array.isArray(result)) return result as unknown[];
	return [];
}

export async function executeRows(
	executor: { execute: (statement: DrizzleSql) => Promise<unknown> },
	statement: DrizzleSql,
): Promise<unknown[]> {
	return coerceRows(await executor.execute(statement));
}

// ── Pool Configuration ───────────────────────────────────────

const DEFAULT_POOL_MAX = 26;
const DEFAULT_IDLE_TIMEOUT_SEC = 60;
const DEFAULT_CONNECTION_TIMEOUT_SEC = 10;
const DEFAULT_MAX_LIFETIME_SEC = 3600;

export type PoolOptions = {
	max: number;
	idleTimeoutSec: number;
	connectionTimeoutSec: number;
	maxLifetimeSec: number;
};

// ── Factory ──────────────────────────────────────────────────

// MUST: MUST-1

export async function createDb(databaseUrl: string, options?: Partial<PoolOptions>): Promise<Db> {
	const pool: PoolOptions = {
		max: options?.max ?? DEFAULT_POOL_MAX,
		idleTimeoutSec: options?.idleTimeoutSec ?? DEFAULT_IDLE_TIMEOUT_SEC,
		connectionTimeoutSec: options?.connectionTimeoutSec ?? DEFAULT_CONNECTION_TIMEOUT_SEC,
		maxLifetimeSec: options?.maxLifetimeSec ?? DEFAULT_MAX_LIFETIME_SEC,
	};

	const client = new BunSql({
		url: databaseUrl,
		max: pool.max,
		idleTimeout: pool.idleTimeoutSec,
		connectionTimeout: pool.connectionTimeoutSec,
		maxLifetime: pool.maxLifetimeSec,
	});

	const db = drizzle({ client, schema });

	const close = async (options?: { timeout?: number }) => {
		const maybeClose = (client as unknown as { close?: (opts?: { timeout?: number }) => Promise<void> }).close;
		if (typeof maybeClose === 'function') {
			await maybeClose(options);
		}
	};

	return Object.assign(db, { close }) as Db;
}

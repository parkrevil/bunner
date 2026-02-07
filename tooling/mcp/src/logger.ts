/**
 * Structured Logger — §8.3 관측성 (Structured Logging)
 *
 * sync events, query events, errors → JSON format.
 * MCP 서버는 stdio transport를 사용하므로 로그는 stderr로 출력.
 *
 * @see MCP_PLAN §8.3
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogEntry = {
	timestamp: string;
	level: LogLevel;
	module: string;
	message: string;
	[key: string]: unknown;
};

const LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

let minLevel: LogLevel = 'info';

/**
 * 최소 로그 레벨 설정.
 */
export function setLogLevel(level: LogLevel): void {
	minLevel = level;
}

/**
 * 구조화된 JSON 로그를 stderr로 출력.
 * MCP stdio transport (stdout)와 간섭하지 않음.
 */
function emit(entry: LogEntry): void {
	if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[minLevel]) return;
	const line = JSON.stringify(entry);
	process.stderr.write(`${line}\n`);
}

/**
 * 범용 로그 함수.
 */
function log(level: LogLevel, module: string, message: string, extra?: Record<string, unknown>): void {
	emit({
		timestamp: new Date().toISOString(),
		level,
		module,
		message,
		...extra,
	});
}

// ── Public API ──────────────────────────────────────────────

export const kbLog = {
	debug: (module: string, message: string, extra?: Record<string, unknown>) => log('debug', module, message, extra),
	info: (module: string, message: string, extra?: Record<string, unknown>) => log('info', module, message, extra),
	warn: (module: string, message: string, extra?: Record<string, unknown>) => log('warn', module, message, extra),
	error: (module: string, message: string, extra?: Record<string, unknown>) => log('error', module, message, extra),

	/**
	 * Sync event 로깅 — sync-worker, watcher 등에서 사용.
	 */
	sync: (message: string, extra?: Record<string, unknown>) => log('info', 'sync', message, extra),

	/**
	 * Query event 로깅 — MCP tool 호출 시 사용.
	 */
	query: (tool: string, durationMs: number, extra?: Record<string, unknown>) => {
		log('info', 'query', `tool=${tool} duration=${durationMs}ms`, { tool, durationMs, ...extra });
	},
};

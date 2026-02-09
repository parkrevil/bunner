/**
 * Logger — human-friendly console formatting.
 *
 * Policy:
 * - Pretty formatting for humans (agent/operator).
 * - HTTP-only is the primary runtime; logs go through console.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function formatExtra(extra?: Record<string, unknown>): string {
	if (!extra) return '';
	const keys = Object.keys(extra);
	if (keys.length === 0) return '';
	// stable-ish formatting: sorted keys, single-line JSON values
	keys.sort();
	const parts = keys.map((k) => `${k}=${safeStringify(extra[k])}`);
	return ` { ${parts.join(' ')} }`;
}

/**
 * 범용 로그 함수.
 */
function log(level: LogLevel, module: string, message: string, extra?: Record<string, unknown>): void {
	if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;
	const ts = new Date().toISOString();
	const lvl = level.toUpperCase().padEnd(5);
	const mod = module.padEnd(12);
	const line = `${ts} ${lvl} ${mod} ${message}${formatExtra(extra)}`;
	if (level === 'warn' || level === 'error') {
		console.error(line);
	} else {
		console.log(line);
	}
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

/**
 * File Watcher — §3.3 Layer 2: Watch — fs.watch + Debounce
 *
 * 설정된 include 디렉토리에 fs.watch({ recursive: true }) 등록.
 * 이벤트 → debounce 시간 후 sync queue에 enqueue.
 *
 * watch 실패 시: throw 하지 않고 kb_health()에 watch_healthy: false 노출.
 *
 * @see MCP_PLAN §3.3, §8.8
 */

import { watch, type FSWatcher } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { SyncQueue } from './sync-queue';
import type { HashCache } from './hash-cache';
import type { KBConfig } from './config';
import { kbLog } from './logger';

export class FileWatcher {
	private watchers: FSWatcher[] = [];
	private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
	private _healthy = false;
	private _watchedDirs: string[] = [];

	private queue: SyncQueue;
	private hashCache: HashCache;
	private config: KBConfig;
	private repoRoot: string;

	constructor(deps: {
		queue: SyncQueue;
		hashCache: HashCache;
		config: KBConfig;
		repoRoot: string;
	}) {
		this.queue = deps.queue;
		this.hashCache = deps.hashCache;
		this.config = deps.config;
		this.repoRoot = deps.repoRoot;
	}

	get healthy(): boolean {
		return this._healthy;
	}

	get watchedDirs(): string[] {
		return this._watchedDirs;
	}

	/**
	 * Watch 시작 — config.watch.include의 각 디렉토리에 대해 fs.watch 등록.
	 */
	start(): void {
		const debounceMs = this.config.watch.debounceMs;

		for (const dir of this.config.watch.include) {
			const absDir = resolve(this.repoRoot, dir);

			try {
				const watcher = watch(absDir, { recursive: true }, (_event, relativePath) => {
					if (!relativePath) return;

					const filePath = relative(this.repoRoot, resolve(absDir, relativePath));

					// exclude 규칙 간단 체크
					if (this.isExcluded(filePath)) return;

					// debounce
					const existing = this.debounceTimers.get(filePath);
					if (existing) clearTimeout(existing);

					this.debounceTimers.set(
						filePath,
						setTimeout(() => {
							this.debounceTimers.delete(filePath);

							// hash cache evict — watch event 시 해당 파일만 evict
							this.hashCache.evict(filePath);

							// sync queue에 enqueue
							this.queue.enqueue(filePath, 'watch');

							kbLog.sync('File change detected', { filePath, source: 'watch' });
						}, debounceMs),
					);
				});

				this.watchers.push(watcher);
				this._watchedDirs.push(dir);
			} catch {
				// §3.3: watch 실패 시 에러를 throw하지 않고 healthy=false
				continue;
			}
		}

		this._healthy = this.watchers.length > 0;
		kbLog.info('watcher', `Watch started`, { healthy: this._healthy, dirs: this._watchedDirs });
	}

	/**
	 * Watch 중지.
	 */
	stop(): void {
		for (const watcher of this.watchers) {
			watcher.close();
		}
		this.watchers = [];
		this._healthy = false;

		// debounce timers 정리
		for (const timer of this.debounceTimers.values()) {
			clearTimeout(timer);
		}
		this.debounceTimers.clear();
	}

	/**
	 * 간단한 exclude 체크 (scanner.ts의 상세 체크와 동일한 규칙).
	 */
	private isExcluded(filePath: string): boolean {
		const parts = filePath.split('/');

		for (const d of this.config.scan.exclude.dirs) {
			if (parts.includes(d)) return true;
		}

		const name = parts[parts.length - 1] ?? '';
		if (this.config.scan.exclude.files.includes(name)) return true;

		const dotIdx = name.lastIndexOf('.');
		if (dotIdx >= 0) {
			const ext = name.slice(dotIdx);
			if (this.config.scan.exclude.extensions.includes(ext)) return true;
		}

		for (const pattern of this.config.scan.exclude.patterns) {
			if (pattern.endsWith('*')) {
				const prefix = pattern.slice(0, -1);
				if (name.startsWith(prefix)) return true;
			} else if (name === pattern) {
				return true;
			}
		}

		return false;
	}
}

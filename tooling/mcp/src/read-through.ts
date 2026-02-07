/**
 * Read-through Validation — §3.4 Layer 3: Read-through — Lightweight Validation
 *
 * 읽기 도구 호출 시, 반환 직전에 hash 비교만 수행 (re-extract는 하지 않음).
 *
 * - content_hash 일치: 그대로 반환
 * - content_hash 불일치: stale: true 플래그 부착 + sync queue에 enqueue(priority=high) + 현재 결과 즉시 반환
 * - 파일 삭제됨: 결과에서 제외 + tombstone + sync queue에 enqueue
 * - 파일 읽기 실패: 현재 결과 반환 + stale: true
 *
 * In-Memory Hash Cache 활용: cache hit 시 disk I/O 없이 비교.
 *
 * @see MCP_PLAN §3.4, §8.2
 */

import { resolve } from 'node:path';
import type { HashCache } from './hash-cache';
import type { SyncQueue } from './sync-queue';
import { computeContentHash } from './scanner';

export type StaleCheckResult = {
	/** 파일이 stale한지 여부 */
	stale: boolean;
	/** 파일이 삭제되었는지 여부 */
	deleted: boolean;
	/** 현재 content_hash (확인 가능한 경우) */
	currentHash?: string;
};

export class ReadThroughValidator {
	private hashCache: HashCache;
	private queue: SyncQueue;
	private repoRoot: string;
	private enabled: boolean;

	constructor(deps: {
		hashCache: HashCache;
		queue: SyncQueue;
		repoRoot: string;
		enabled: boolean;
	}) {
		this.hashCache = deps.hashCache;
		this.queue = deps.queue;
		this.repoRoot = deps.repoRoot;
		this.enabled = deps.enabled;
	}

	/**
	 * 단일 source의 freshness 검증.
	 *
	 * @param filePath repo-relative path
	 * @param dbContentHash DB에 저장된 content_hash
	 */
	async validateSource(filePath: string, dbContentHash: string): Promise<StaleCheckResult> {
		if (!this.enabled) {
			return { stale: false, deleted: false };
		}

		// 1. In-memory hash cache 확인
		const cached = this.hashCache.lookup(filePath);
		if (cached) {
			if (cached.contentHash === dbContentHash) {
				return { stale: false, deleted: false, currentHash: cached.contentHash };
			}
			// cache miss와 hash 불일치 → stale
			this.queue.enqueue(filePath, 'read_through');
			return { stale: true, deleted: false, currentHash: cached.contentHash };
		}

		// 2. Cache miss → disk 접근
		try {
			const absPath = resolve(this.repoRoot, filePath);
			const bunFile = Bun.file(absPath);

			const exists = await bunFile.exists();
			if (!exists) {
				// 파일 삭제됨
				this.queue.enqueue(filePath, 'read_through');
				return { stale: true, deleted: true };
			}

			const currentHash = await computeContentHash(absPath);

			// 캐시에 저장
			this.hashCache.set(filePath, {
				contentHash: currentHash,
				mtime: Date.now(),
			});

			if (currentHash === dbContentHash) {
				return { stale: false, deleted: false, currentHash };
			}

			// hash 불일치 → stale
			this.queue.enqueue(filePath, 'read_through');
			return { stale: true, deleted: false, currentHash };
		} catch {
			// 파일 읽기 실패 → stale로 처리
			return { stale: true, deleted: false };
		}
	}

	/**
	 * 여러 source를 일괄 검증.
	 * 결과 맵: filePath → StaleCheckResult
	 */
	async validateSources(
		sources: Array<{ filePath: string; contentHash: string }>,
	): Promise<Map<string, StaleCheckResult>> {
		const results = new Map<string, StaleCheckResult>();

		for (const source of sources) {
			const result = await this.validateSource(source.filePath, source.contentHash);
			results.set(source.filePath, result);
		}

		return results;
	}
}

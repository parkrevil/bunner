/**
 * In-Memory Hash Cache — §3.4, §8.1
 *
 * file_path → { contentHash, mtime } 캐시.
 * Read-through 시 disk I/O 없이 캐시에서 비교 (cache miss 시에만 disk 접근).
 * Watch event 시 해당 파일만 evict.
 *
 * @see MCP_PLAN §3.4 In-Memory Hash Cache, §8.1
 */

export type HashCacheEntry = {
	contentHash: string;
	mtime: number;
};

export class HashCache {
	private cache = new Map<string, HashCacheEntry>();

	get size(): number {
		return this.cache.size;
	}

	/**
	 * 캐시에서 파일의 hash 조회.
	 */
	get(filePath: string): HashCacheEntry | undefined {
		return this.cache.get(filePath);
	}

	/**
	 * 캐시에 파일의 hash 저장.
	 */
	set(filePath: string, entry: HashCacheEntry): void {
		this.cache.set(filePath, entry);
	}

	/**
	 * watch event 시 해당 파일만 evict.
	 */
	evict(filePath: string): void {
		this.cache.delete(filePath);
	}

	/**
	 * 여러 파일 evict.
	 */
	evictBatch(filePaths: string[]): void {
		for (const fp of filePaths) {
			this.cache.delete(fp);
		}
	}

	/**
	 * 전체 캐시 초기화.
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * 캐시 hit rate 계산용 통계.
	 */
	private hits = 0;
	private misses = 0;

	/**
	 * hit rate 기반 조회 — 통계 추적 포함.
	 */
	lookup(filePath: string): HashCacheEntry | undefined {
		const entry = this.cache.get(filePath);
		if (entry) {
			this.hits++;
		} else {
			this.misses++;
		}
		return entry;
	}

	/**
	 * hit rate (0~1).
	 */
	get hitRate(): number {
		const total = this.hits + this.misses;
		if (total === 0) return 0;
		return this.hits / total;
	}

	/**
	 * 통계 리셋.
	 */
	resetStats(): void {
		this.hits = 0;
		this.misses = 0;
	}
}

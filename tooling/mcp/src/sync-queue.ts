/**
 * In-Memory Priority Sync Queue — §3.1 Sync Queue
 *
 * priority: read_through(3) > watch(2) > startup(1)
 * 동일 filePath는 중복 enqueue 방지 (더 높은 priority로 교체).
 *
 * @see MCP_PLAN §3.1, §3.5
 */

export type SyncTrigger = 'startup' | 'watch' | 'manual' | 'read_through';

export type SyncItem = {
	filePath: string;
	trigger: SyncTrigger;
	priority: number;
	enqueuedAt: number;
};

const PRIORITY_MAP: Record<SyncTrigger, number> = {
	startup: 1,
	manual: 2,
	watch: 2,
	read_through: 3,
};

/**
 * In-memory priority sync queue.
 *
 * - 높은 priority를 먼저 처리
 * - 동일 filePath 중복 방지 (higher priority로 교체)
 * - FIFO within same priority (enqueuedAt 순)
 */
export class SyncQueue {
	private items: Map<string, SyncItem> = new Map();
	private resolvers: (() => void)[] = [];

	get size(): number {
		return this.items.size;
	}

	get depth(): number {
		return this.items.size;
	}

	/**
	 * 파일을 sync queue에 enqueue.
	 * 이미 동일 filePath가 있으면 priority가 더 높은 경우만 교체.
	 */
	enqueue(filePath: string, trigger: SyncTrigger): void {
		const priority = PRIORITY_MAP[trigger];
		const existing = this.items.get(filePath);

		if (existing && existing.priority >= priority) {
			return; // 이미 같거나 높은 priority로 큐에 있음
		}

		this.items.set(filePath, {
			filePath,
			trigger,
			priority,
			enqueuedAt: Date.now(),
		});

		// 대기 중인 consumer를 깨움
		while (this.resolvers.length > 0) {
			const resolve = this.resolvers.shift()!;
			resolve();
		}
	}

	/**
	 * 여러 파일을 한 번에 enqueue.
	 */
	enqueueBatch(files: string[], trigger: SyncTrigger): void {
		for (const filePath of files) {
			this.enqueue(filePath, trigger);
		}
	}

	/**
	 * priority 가장 높은 항목을 dequeue.
	 * 같은 priority면 먼저 enqueue된 것.
	 */
	dequeue(): SyncItem | undefined {
		if (this.items.size === 0) return undefined;

		let best: SyncItem | undefined;
		for (const item of this.items.values()) {
			if (
				!best ||
				item.priority > best.priority ||
				(item.priority === best.priority && item.enqueuedAt < best.enqueuedAt)
			) {
				best = item;
			}
		}

		if (best) {
			this.items.delete(best.filePath);
		}

		return best;
	}

	/**
	 * 큐에 항목이 생길 때까지 대기.
	 * 이미 항목이 있으면 즉시 resolve.
	 */
	async waitForItem(): Promise<void> {
		if (this.items.size > 0) return;
		return new Promise<void>((resolve) => {
			this.resolvers.push(resolve);
		});
	}

	/**
	 * 큐 비우기.
	 */
	clear(): void {
		this.items.clear();
	}

	/**
	 * 특정 filePath가 큐에 있는지 확인.
	 */
	has(filePath: string): boolean {
		return this.items.has(filePath);
	}
}

type WriteJob = () => void;

class WriteBehindQueue {
  private chain: Promise<void> = new Promise<void>(resolve => {
    resolve();
  });
  private pending = 0;
  private lastError: Error | null = null;

  enqueue(job: WriteJob): void {
    this.pending += 1;

    const previous = this.chain;

    this.chain = (async (): Promise<void> => {
      try {
        await previous;
      } catch {
        // ignore
      }

      try {
        job();
      } catch (error) {
        this.lastError = error instanceof Error ? error : new Error(String(error));
      } finally {
        this.pending = Math.max(0, this.pending - 1);
      }
    })();
  }

  getPendingCount(): number {
    return this.pending;
  }

  getLastError(): Error | null {
    return this.lastError;
  }

  async flush(timeoutMs?: number): Promise<void> {
    if (timeoutMs === undefined) {
      await this.chain;

      return;
    }

    const resolved = Math.max(0, Math.floor(timeoutMs));

    if (resolved === 0) {
      return;
    }

    await Promise.race([
      this.chain,
      new Promise<void>(resolve => {
        setTimeout(resolve, resolved);
      }),
    ]);
  }
}

export { WriteBehindQueue };

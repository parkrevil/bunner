type WriteJob = () => void;

class WriteBehindQueue {
  private chain: Promise<void> = Promise.resolve();
  private pending = 0;
  private lastError: unknown = null;

  enqueue(job: WriteJob): void {
    this.pending += 1;

    this.chain = this.chain
      .then(async () => {
        try {
          job();
        } catch (error) {
          this.lastError = error;
        }
      })
      .finally(() => {
        this.pending = Math.max(0, this.pending - 1);
      });
  }

  getPendingCount(): number {
    return this.pending;
  }

  getLastError(): unknown {
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

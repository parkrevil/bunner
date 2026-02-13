import { mkdirSync } from 'fs';

import * as watcher from '@parcel/watcher';

import { bunnerCacheDirPath, bunnerCacheFilePath } from '../common/bunner-paths';

export function parseReindexSignalText(text: string): { pid: number; timestampMs: number } | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const [pidLine, tsLine] = trimmed.split(/\r?\n/);

  const pid = Number(pidLine);
  const timestampMs = Number(tsLine);

  if (!Number.isFinite(pid) || !Number.isInteger(pid) || pid <= 0) {
    return null;
  }

  if (!Number.isFinite(timestampMs) || !Number.isInteger(timestampMs) || timestampMs <= 0) {
    return null;
  }

  return { pid, timestampMs };
}

export async function emitReindexSignal(options: {
  projectRoot: string;
  pid: number;
  nowMs: () => number;
}): Promise<{ signalPath: string }> {
  const signalDir = bunnerCacheDirPath(options.projectRoot);
  const signalPath = bunnerCacheFilePath(options.projectRoot, 'reindex.signal');

  mkdirSync(signalDir, { recursive: true });
  await Bun.write(signalPath, `${options.pid}\n${options.nowMs()}\n`);

  return { signalPath };
}

export class ReindexSignalWatcher {
  private subscription: watcher.AsyncSubscription | undefined;
  private readonly signalDir: string;
  private readonly signalPath: string;

  constructor(options: { projectRoot: string }) {
    this.signalDir = bunnerCacheDirPath(options.projectRoot);
    this.signalPath = bunnerCacheFilePath(options.projectRoot, 'reindex.signal');
  }

  async start(onSignal: (signal: { pid: number; timestampMs: number }) => void) {
    this.subscription = await watcher.subscribe(this.signalDir, async (_err, events) => {
      for (const evt of events) {
        if (evt.path !== this.signalPath) {
          continue;
        }

        const text = await Bun.file(this.signalPath).text();
        const parsed = parseReindexSignalText(text);
        if (parsed) {
          onSignal(parsed);
        }

        break;
      }
    });
  }

  async close() {
    await this.subscription?.unsubscribe();
    this.subscription = undefined;
  }
}

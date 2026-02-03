import { hashString } from '../../engine/hasher';
import { runWithConcurrency } from '../../engine/promise-pool';
import type { FileIndexRepository } from '../../ports/file-index.repository';

interface IndexTargetsInput {
  readonly projectKey: string;
  readonly targets: ReadonlyArray<string>;
  readonly repository: FileIndexRepository;
  readonly concurrency?: number;
}

const indexTargets = async (input: IndexTargetsInput): Promise<void> => {
  const concurrency = input.concurrency ?? 8;

  await runWithConcurrency(input.targets, concurrency, async filePath => {
    try {
      const stats = await Bun.file(filePath).stat();
      const mtimeMs = stats.mtimeMs;
      const size = stats.size;
      const existing = await input.repository.getFile({ projectKey: input.projectKey, filePath });

      if (existing && existing.mtimeMs === mtimeMs && existing.size === size) {
        return;
      }

      const file = Bun.file(filePath);
      const content = await file.text();
      const contentHash = hashString(content);

      await input.repository.upsertFile({
        projectKey: input.projectKey,
        filePath,
        mtimeMs,
        size,
        contentHash,
      });
    } catch {
      await input.repository.deleteFile({ projectKey: input.projectKey, filePath });
    }
  });
};

export { indexTargets };

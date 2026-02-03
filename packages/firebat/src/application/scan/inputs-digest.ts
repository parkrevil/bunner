import { hashString } from '../../engine/hasher';
import type { FileIndexRepository } from '../../ports/file-index.repository';

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/');

interface ComputeInputsDigestInput {
  readonly projectKey: string;
  readonly targets: ReadonlyArray<string>;
  readonly fileIndexRepository: FileIndexRepository;
}

const computeInputsDigest = async (input: ComputeInputsDigestInput): Promise<string> => {
  const normalizedTargets = [...input.targets].map(normalizePath).sort();
  const parts: string[] = [];

  for (const filePath of normalizedTargets) {
    try {
      const entry = await input.fileIndexRepository.getFile({ projectKey: input.projectKey, filePath });

      if (entry) {
        parts.push(`file:${filePath}:${entry.contentHash}`);

        continue;
      }

      const stats = await Bun.file(filePath).stat();
      const content = await Bun.file(filePath).text();
      const contentHash = hashString(content);

      await input.fileIndexRepository.upsertFile({
        projectKey: input.projectKey,
        filePath,
        mtimeMs: stats.mtimeMs,
        size: stats.size,
        contentHash,
      });

      parts.push(`file:${filePath}:${contentHash}`);
    } catch {
      parts.push(`missing:${filePath}`);
    }
  }

  return hashString(parts.join('|'));
};

export { computeInputsDigest };

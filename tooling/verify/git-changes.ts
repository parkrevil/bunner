import { runCapture } from './utils/spawn-utils';
import { splitLines } from './utils/text-utils';

const repoRoot = process.cwd();

const runCaptureAtRoot = (cmd: string, args: readonly string[]): string | null =>
  runCapture({ cwd: repoRoot, env: process.env }, cmd, args);

const getChangedFiles = (): string[] => {
  const changed = new Set<string>();

  for (const name of splitLines(runCaptureAtRoot('git', ['diff', '--name-only', '--diff-filter=ACMRTUXB']))) {
    changed.add(name);
  }

  for (const name of splitLines(runCaptureAtRoot('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMRTUXB']))) {
    changed.add(name);
  }

  for (const name of splitLines(runCaptureAtRoot('git', ['ls-files', '--others', '--exclude-standard']))) {
    changed.add(name);
  }

  return [...changed];
};

export { getChangedFiles };

import * as path from 'node:path';

const uniqueSorted = (values: ReadonlyArray<string>): string[] => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const toAbsolutePaths = (cwd: string, filePaths: ReadonlyArray<string>): string[] =>
  uniqueSorted(filePaths.map(filePath => path.resolve(cwd, filePath)));

const runGitLsFiles = (cwd: string, patterns: ReadonlyArray<string>): string[] | null => {
  const result = Bun.spawnSync({
    cmd: ['git', 'ls-files', ...patterns],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (result.exitCode !== 0) {
    return null;
  }

  const output = result.stdout.toString('utf8').trim();

  if (output.length === 0) {
    return [];
  }

  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
};

const scanWithGlob = async (cwd: string, patterns: ReadonlyArray<string>): Promise<string[]> => {
  const matches: string[] = [];

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);

    for await (const filePath of glob.scan({ cwd, onlyFiles: true, followSymlinks: false })) {
      matches.push(filePath);
    }
  }

  return uniqueSorted(matches);
};

const DEFAULT_SOURCE_PATTERNS: ReadonlyArray<string> = [
  'packages/**/src/**/*.ts',
  'packages/**/src/**/*.tsx',
  'examples/**/src/**/*.ts',
  'examples/**/src/**/*.tsx',
  'tooling/**/*.ts',
  'verify/**/*.ts',
];

export const discoverDefaultTargets = async (cwd: string = process.cwd()): Promise<string[]> => {
  const gitMatches = runGitLsFiles(cwd, DEFAULT_SOURCE_PATTERNS);

  if (gitMatches !== null) {
    return toAbsolutePaths(cwd, gitMatches);
  }

  const globMatches = await scanWithGlob(cwd, DEFAULT_SOURCE_PATTERNS);

  return toAbsolutePaths(cwd, globMatches);
};

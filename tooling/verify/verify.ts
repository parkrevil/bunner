import path from 'node:path';

import type { RunOptions } from './types';

import { runDocVerify } from './doc-verify';
import { getChangedFiles } from './git-changes';
import { runPlanTaskVerify } from './plan-task-verify';

const CODE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs']);
const repoRoot = process.cwd();
const VERIFY_OXLINT_EXCLUDE = new Set();

const normalizePath = (value: string): string => value.replaceAll('\\', '/');

const listExtensions = (): string => [...CODE_EXTENSIONS].sort().join(', ');

const run = (cmd: string, args: readonly string[], options: RunOptions = {}): void => {
  const child = Bun.spawnSync([cmd, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? Bun.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = typeof child.exitCode === 'number' ? child.exitCode : 1;

  if (code !== 0) {
    process.exit(code);
  }
};

const hasCodeChanges = (files: readonly string[]): boolean =>
  files.some(file => {
    const ext = path.extname(file);

    return CODE_EXTENSIONS.has(ext);
  });

const hasMarkdownChanges = (files: readonly string[]): boolean => files.some(file => path.extname(file) === '.md');

const listChangedTaskFiles = (files: readonly string[]): string[] =>
  files.map(normalizePath).filter(file => file.startsWith('tasks/') && file.endsWith('.md'));

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const globToRegExp = (glob: string): RegExp => {
  const normalized = normalizePath(glob);
  const pieces: string[] = [];

  for (let index = 0; index < normalized.length; index++) {
    const current = normalized[index] ?? '';
    const next = normalized[index + 1] ?? '';

    if (current === '*' && next === '*') {
      pieces.push('.*');

      index += 1;

      continue;
    }

    if (current === '*') {
      pieces.push('[^/]*');

      continue;
    }

    if (current === '?') {
      pieces.push('[^/]');

      continue;
    }

    pieces.push(escapeRegExp(current));
  }

  return new RegExp(`^${pieces.join('')}$`);
};

const extractAllowedPathsFromTask = (contents: string): string[] => {
  const lines = contents.split(/\r?\n/g);
  const patterns: string[] = [];
  let inAllowedPaths = false;

  for (const line of lines) {
    if (!inAllowedPaths) {
      if (line.includes('Allowed paths') && line.includes('(MUST')) {
        inAllowedPaths = true;
      }

      continue;
    }

    const trimmed = line.trim();

    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      break;
    }

    if (
      trimmed.startsWith('- File → MUST IDs') ||
      trimmed.startsWith('- Public API impact') ||
      trimmed.startsWith('- Scope delta rule')
    ) {
      break;
    }

    const match = trimmed.match(/^[-*]\s+`([^`]+)`\s*$/);
    const matched = match?.[1];

    if (typeof matched === 'string' && matched.length > 0) {
      patterns.push(matched);

      continue;
    }

    const rawMatch = trimmed.match(/^[-*]\s+([^\s`].+)$/);
    const raw = rawMatch?.[1];

    if (typeof raw === 'string' && raw.length > 0) {
      patterns.push(raw.trim());
    }
  }

  return patterns;
};

const assertAllowedPaths = async (files: readonly string[], taskFiles: readonly string[]): Promise<void> => {
  const changedCodeFiles = listChangedCodeFiles(files).map(normalizePath);

  if (changedCodeFiles.length === 0) {
    return;
  }

  const patterns: string[] = [];

  for (const taskFile of taskFiles) {
    if (!(await Bun.file(taskFile).exists())) {
      continue;
    }

    patterns.push(...extractAllowedPathsFromTask(await Bun.file(taskFile).text()));
  }

  const uniquePatterns = [...new Set(patterns.map(p => p.trim()).filter(p => p.length > 0))];

  if (uniquePatterns.length === 0) {
    console.error('[verify] ❌ Code changes detected, but no Allowed paths were found in changed tasks/*.md');
    console.error('[verify]    Add Allowed paths (MUST) list to the task(s) for machine gating.');

    process.exit(1);
  }

  const matchers = uniquePatterns.map(globToRegExp);
  const outOfScope = changedCodeFiles.filter(file => !matchers.some(re => re.test(file)));

  if (outOfScope.length > 0) {
    console.error('[verify] ❌ Code changes detected outside task Allowed paths.');
    console.error(`[verify]    Out of scope (${outOfScope.length}):`);

    for (const file of outOfScope.slice(0, 20)) {
      console.error(`- ${file}`);
    }

    process.exit(1);
  }
};

const listChangedCodeFiles = (files: readonly string[]): string[] =>
  files.filter(file => {
    const ext = path.extname(file);

    if (!CODE_EXTENSIONS.has(ext)) {
      return false;
    }

    const normalized = file.replaceAll('\\', '/');

    return !VERIFY_OXLINT_EXCLUDE.has(normalized);
  });

interface ForbiddenPattern {
  readonly name: string;
  readonly re: RegExp;
}

const assertNoForbiddenSourcePatterns = async (changedCodeFiles: readonly string[]): Promise<void> => {
  const forbiddenPatterns: ReadonlyArray<ForbiddenPattern> = [
    { name: 'dynamic-import', re: /\bimport\s*\(/g },
    { name: 'hardcoded-node_modules-path', re: /\bnode_modules\b/g },
    { name: 'process-cwd-node_modules', re: /process\.cwd\(\)\s*,\s*['"][^'"]*node_modules/gi },
  ];
  const violations: string[] = [];

  for (const filePath of changedCodeFiles) {
    const file = Bun.file(filePath);
    const exists = await file.exists();

    if (!exists) {
      continue;
    }

    const contents = await file.text();

    for (const entry of forbiddenPatterns) {
      if (entry.re.test(contents)) {
        violations.push(`[verify] ❌ Forbidden source pattern (${entry.name}) found in: ${filePath}`);
      }

      entry.re.lastIndex = 0;
    }
  }

  if (violations.length > 0) {
    for (const line of violations.slice(0, 20)) {
      console.error(line);
    }

    if (violations.length > 20) {
      console.error(`[verify]    ...and ${violations.length - 20} more`);
    }

    process.exit(1);
  }
};

const runVerify = async (): Promise<void> => {
  const files = getChangedFiles();
  const didRunDocVerify = hasMarkdownChanges(files) ? await runDocVerify(files) : false;
  const didRunPlanTaskVerify = hasMarkdownChanges(files) ? await runPlanTaskVerify(files) : false;
  const hasCode = hasCodeChanges(files);
  const didRunAnyDocs = didRunDocVerify ?? didRunPlanTaskVerify;
  const changedTaskFiles = listChangedTaskFiles(files);

  console.log(`[verify] 📂 Detected ${files.length} changed file(s).`);

  if (!hasCode && !didRunAnyDocs) {
    console.log(`[verify] 💤 No ${listExtensions()} or doc template changes detected. Skipping.`);

    return;
  }

  if (!hasCode) {
    console.log(`[verify] 🧾 No ${listExtensions()} changes detected. Skipping code checks.`);

    return;
  }

  if (changedTaskFiles.length === 0) {
    console.error(`[verify] ❌ ${listExtensions()} changes detected, but no tasks/*.md changes were found.`);
    console.error('[verify]    Create/update at least one tasks/*.md to keep spec → plan → task mechanically traceable.');

    process.exit(1);
  }

  await assertAllowedPaths(files, changedTaskFiles);

  await assertNoForbiddenSourcePatterns(listChangedCodeFiles(files).map(normalizePath));

  console.log(`[verify] ✅ ${listExtensions()} changes detected. Running quality gate...`);

  const changedCodeFiles = listChangedCodeFiles(files);

  if (changedCodeFiles.length === 0) {
    console.log('[verify] 🧹 No lint targets after exclusions. Skipping lint.');
  } else {
    console.log('[verify] 🔍 Linting full project (bun run lint)...');

    run('bun', ['run', 'lint']);
  }

  console.log('[verify] 🧪 Running tests...');

  run('bun', ['run', 'test']);
};

export { runVerify };

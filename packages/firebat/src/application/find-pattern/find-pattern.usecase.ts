import * as path from 'node:path';

import { discoverDefaultTargets } from '../../target-discovery';
import { findPatternInFiles, type AstGrepMatch } from '../../infrastructure/ast-grep/find-pattern';

interface JsonObject {
  readonly [k: string]: JsonValue;
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<JsonValue>
  | JsonObject;

interface FindPatternInput {
  readonly targets?: ReadonlyArray<string>;
  readonly rule?: JsonValue;
  readonly matcher?: JsonValue;
  readonly ruleName?: string;
}

const uniqueSorted = (values: ReadonlyArray<string>): string[] =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const expandTargets = async (cwd: string, targets: ReadonlyArray<string>): Promise<string[]> => {
  const hasGlob = targets.some(value => value.includes('*'));

  if (!hasGlob) {
    return uniqueSorted(targets.map(t => path.resolve(cwd, t)));
  }

  const matches: string[] = [];

  for (const pattern of targets) {
    const glob = new Bun.Glob(pattern);

    for await (const filePath of glob.scan({ cwd, onlyFiles: true, followSymlinks: false })) {
      matches.push(path.resolve(cwd, filePath));
    }
  }

  return uniqueSorted(matches);
};

const findPatternUseCase = async (input: FindPatternInput): Promise<ReadonlyArray<AstGrepMatch>> => {
  const cwd = process.cwd();
  const targetsRaw = input.targets !== undefined && input.targets.length > 0 ? input.targets : await discoverDefaultTargets(cwd);
  const targets = await expandTargets(cwd, targetsRaw);
  const request: Parameters<typeof findPatternInFiles>[0] = { targets };

  if (input.rule !== undefined) {
    request.rule = input.rule;
  }

  if (input.matcher !== undefined) {
    request.matcher = input.matcher;
  }

  if (input.ruleName !== undefined) {
    request.ruleName = input.ruleName;
  }

  return findPatternInFiles(request);
};

export { findPatternUseCase };

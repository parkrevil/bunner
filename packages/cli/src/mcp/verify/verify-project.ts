import type { ResolvedBunnerConfig } from '../../common/interfaces';

import { join } from 'path';

import { bunnerCardsGlobRel } from '../../common';

import { readCardFile } from '../card/card-fs';

type Severity = 'error' | 'warning';

export type VerifyIssueCode =
  | 'CARD_KEY_DUPLICATE'
  | 'CARD_TYPE_NOT_ALLOWED'
  | 'SEE_TARGET_MISSING'
  | 'SEE_TYPE_MISMATCH'
  | 'RELATION_TARGET_MISSING'
  | 'RELATION_TARGET_TYPE_MISMATCH'
  | 'RELATION_TYPE_NOT_ALLOWED'
  | 'IMPLEMENTED_CARD_NO_CODE_LINKS'
  | 'CONFIRMED_CARD_NO_CODE_LINKS'
  | 'DEPENDS_ON_CYCLE'
  | 'REFERENCES_DEPRECATED_CARD';

export interface VerifyIssue {
  severity: Severity;
  code: VerifyIssueCode;
  message: string;
  filePath?: string;
  cardKey?: string;
}

export interface VerifyProjectInput {
  projectRoot: string;
  config: ResolvedBunnerConfig;
}

export interface VerifyProjectResult {
  ok: boolean;
  errors: VerifyIssue[];
  warnings: VerifyIssue[];
}

function toPosixPath(path: string): string {
  return path.replace(/\\/g, '/');
}

function normalizeSourceDirRel(sourceDir: string): string {
  const trimmed = sourceDir.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '').replace(/\/$/, '');
  return trimmed.length === 0 ? 'src' : trimmed;
}

async function scanGlobRel(projectRoot: string, pattern: string): Promise<string[]> {
  const glob = new Bun.Glob(pattern);
  const out: string[] = [];
  for await (const rel of glob.scan({ cwd: projectRoot, onlyFiles: true, dot: true })) {
    out.push(toPosixPath(String(rel)));
  }
  return out;
}

async function buildExcludeSet(projectRoot: string, patterns: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  for (const pattern of patterns) {
    // eslint-disable-next-line no-await-in-loop
    const matches = await scanGlobRel(projectRoot, pattern);
    for (const rel of matches) {
      set.add(rel);
    }
  }
  return set;
}

function parseSeeCardKeysFromText(text: string): string[] {
  const out: string[] = [];
  const re = /@see\s+([a-zA-Z0-9_-]+::[^\s*]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push(m[1]!);
  }
  return Array.from(new Set(out));
}

function typePrefixOfKey(fullKey: string): string {
  const idx = fullKey.indexOf('::');
  return idx === -1 ? '' : fullKey.slice(0, idx);
}

function addIssue(issues: VerifyIssue[], issue: VerifyIssue) {
  issues.push(issue);
}

export async function verifyProject(input: VerifyProjectInput): Promise<VerifyProjectResult> {
  const { projectRoot, config } = input;

  const sourceDirRel = normalizeSourceDirRel(config.sourceDir);
  const excludeSet = await buildExcludeSet(projectRoot, config.mcp.exclude);

  const cardPathsRel = (await scanGlobRel(projectRoot, bunnerCardsGlobRel())).filter((p) => !excludeSet.has(p));
  const codePathsRel = (await scanGlobRel(projectRoot, `${sourceDirRel}/**/*.ts`)).filter((p) => !excludeSet.has(p));

  const errors: VerifyIssue[] = [];
  const warnings: VerifyIssue[] = [];

  // Parse cards from SSOT files.
  const cardByKey = new Map<string, { type: string; status: string; filePath: string; relations: Array<{ type: string; target: string }> }>();
  const duplicateCardKeys = new Map<string, string[]>();

  for (const relPath of cardPathsRel) {
    const absPath = join(projectRoot, relPath);
    // eslint-disable-next-line no-await-in-loop
    const parsed = await readCardFile(absPath);
    const key = parsed.frontmatter.key;
    const existing = cardByKey.get(key);
    if (existing) {
      const arr = duplicateCardKeys.get(key) ?? [existing.filePath];
      arr.push(relPath);
      duplicateCardKeys.set(key, arr);
      continue;
    }

    cardByKey.set(key, {
      type: parsed.frontmatter.type,
      status: parsed.frontmatter.status,
      filePath: relPath,
      relations: parsed.frontmatter.relations ?? [],
    });
  }

  for (const [key, files] of duplicateCardKeys.entries()) {
    addIssue(errors, {
      severity: 'error',
      code: 'CARD_KEY_DUPLICATE',
      cardKey: key,
      message: `Duplicate card key: ${key} (${files.join(', ')})`,
    });
  }

  const allowedCardTypes = new Set(config.mcp.card.types);
  const allowedRelationTypes = new Set(config.mcp.card.relations);

  for (const [key, c] of cardByKey.entries()) {
    if (!allowedCardTypes.has(c.type)) {
      addIssue(errors, {
        severity: 'error',
        code: 'CARD_TYPE_NOT_ALLOWED',
        cardKey: key,
        filePath: c.filePath,
        message: `Card type not allowed by config: ${c.type}`,
      });
    }

    for (const rel of c.relations) {
      if (!allowedRelationTypes.has(rel.type)) {
        addIssue(errors, {
          severity: 'error',
          code: 'RELATION_TYPE_NOT_ALLOWED',
          cardKey: key,
          filePath: c.filePath,
          message: `Relation type not allowed by config: ${rel.type}`,
        });
      }

      const target = cardByKey.get(rel.target);
      if (!target) {
        addIssue(errors, {
          severity: 'error',
          code: 'RELATION_TARGET_MISSING',
          cardKey: key,
          filePath: c.filePath,
          message: `Relation target missing: ${rel.target}`,
        });
        continue;
      }

      const targetPrefix = typePrefixOfKey(rel.target);
      if (targetPrefix !== target.type) {
        addIssue(errors, {
          severity: 'error',
          code: 'RELATION_TARGET_TYPE_MISMATCH',
          cardKey: key,
          filePath: c.filePath,
          message: `Relation target type prefix mismatch: ${rel.target} (expected ${target.type})`,
        });
      }
    }
  }

  // Scan code files for @see references.
  const seeRefsByCardKey = new Map<string, Set<string>>();

  for (const relPath of codePathsRel) {
    const absPath = join(projectRoot, relPath);
    // eslint-disable-next-line no-await-in-loop
    const text = await Bun.file(absPath).text();
    const keys = parseSeeCardKeysFromText(text);

    for (const fullKey of keys) {
      const card = cardByKey.get(fullKey);
      if (!card) {
        addIssue(errors, {
          severity: 'error',
          code: 'SEE_TARGET_MISSING',
          filePath: relPath,
          message: `@see target card not found: ${fullKey}`,
        });
        continue;
      }

      const prefix = typePrefixOfKey(fullKey);
      if (prefix !== card.type) {
        addIssue(errors, {
          severity: 'error',
          code: 'SEE_TYPE_MISMATCH',
          filePath: relPath,
          cardKey: fullKey,
          message: `@see type prefix mismatch: ${fullKey} (expected ${card.type})`,
        });
        continue;
      }

      const set = seeRefsByCardKey.get(fullKey) ?? new Set<string>();
      set.add(relPath);
      seeRefsByCardKey.set(fullKey, set);
    }
  }

  // Card-centric link checks (implemented/accepted/implementing).
  for (const [key, c] of cardByKey.entries()) {
    const hasLinks = (seeRefsByCardKey.get(key)?.size ?? 0) > 0;
    if (c.status === 'implemented' && !hasLinks) {
      addIssue(errors, {
        severity: 'error',
        code: 'IMPLEMENTED_CARD_NO_CODE_LINKS',
        cardKey: key,
        filePath: c.filePath,
        message: `Implemented card has no @see code references: ${key}`,
      });
    }

    if ((c.status === 'accepted' || c.status === 'implementing') && !hasLinks) {
      addIssue(warnings, {
        severity: 'warning',
        code: 'CONFIRMED_CARD_NO_CODE_LINKS',
        cardKey: key,
        filePath: c.filePath,
        message: `Confirmed card has no @see code references: ${key}`,
      });
    }
  }

  // Soft rule: depends_on cycles.
  const dependsGraph = new Map<string, string[]>();
  for (const [key, c] of cardByKey.entries()) {
    const deps = c.relations.filter((r) => r.type === 'depends_on').map((r) => r.target);
    dependsGraph.set(key, deps);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  let cycleFound = false;

  const dfs = (node: string) => {
    if (cycleFound) return;
    visited.add(node);
    inStack.add(node);
    const next = dependsGraph.get(node) ?? [];
    for (const dst of next) {
      if (!cardByKey.has(dst)) continue;
      if (!visited.has(dst)) {
        dfs(dst);
      } else if (inStack.has(dst)) {
        cycleFound = true;
        return;
      }
    }
    inStack.delete(node);
  };

  for (const key of cardByKey.keys()) {
    if (!visited.has(key)) dfs(key);
    if (cycleFound) break;
  }

  if (cycleFound) {
    addIssue(warnings, {
      severity: 'warning',
      code: 'DEPENDS_ON_CYCLE',
      message: 'depends_on cycle detected',
    });
  }

  // Soft rule: references to deprecated cards (via relations or @see).
  const deprecatedKeys = new Set<string>();
  for (const [key, c] of cardByKey.entries()) {
    if (c.status === 'deprecated') deprecatedKeys.add(key);
  }

  if (deprecatedKeys.size > 0) {
    let referencedDeprecated = false;

    for (const [key, c] of cardByKey.entries()) {
      for (const rel of c.relations) {
        if (deprecatedKeys.has(rel.target)) {
          referencedDeprecated = true;
        }
      }

      if (deprecatedKeys.has(key) && (seeRefsByCardKey.get(key)?.size ?? 0) > 0) {
        referencedDeprecated = true;
      }
    }

    if (referencedDeprecated) {
      addIssue(warnings, {
        severity: 'warning',
        code: 'REFERENCES_DEPRECATED_CARD',
        message: 'References to deprecated cards detected',
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

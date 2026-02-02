import type { DuplicateGroup, DuplicateItem } from '../types';

import type { DuplicateFingerprintResolver, DuplicateItemKindResolver, OxcNodePredicate, ParsedFile } from './types';

import { collectOxcNodes, getNodeHeader } from './oxc-ast-utils';
import { countOxcSize } from './oxc-size-count';
import { getLineColumn } from './source-position';

const collectDuplicateGroups = (
  files: ReadonlyArray<ParsedFile>,
  minSize: number,
  isTarget: OxcNodePredicate,
  resolveFingerprint: DuplicateFingerprintResolver,
  resolveKind: DuplicateItemKindResolver,
): DuplicateGroup[] => {
  const groupsByHash = new Map<string, DuplicateItem[]>();

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    const targets = collectOxcNodes(file.program, isTarget);

    for (const node of targets) {
      const size = countOxcSize(node);

      if (size < minSize) {
        continue;
      }

      const fingerprint = resolveFingerprint(node);
      const existing = groupsByHash.get(fingerprint) ?? [];
      const startOffset = node.start;
      const endOffset = node.end;
      const start = getLineColumn(file.sourceText, startOffset);
      const end = getLineColumn(file.sourceText, endOffset);

      existing.push({
        kind: resolveKind(node),
        header: getNodeHeader(node),
        filePath: file.filePath,
        span: {
          start,
          end,
        },
        size,
      });

      groupsByHash.set(fingerprint, existing);
    }
  }

  const groups: DuplicateGroup[] = [];

  for (const [fingerprint, items] of groupsByHash.entries()) {
    if (items.length < 2) {
      continue;
    }

    groups.push({
      fingerprint,
      items,
    });
  }

  return groups.sort((left, right) => right.items.length - left.items.length);
};

export { collectDuplicateGroups };

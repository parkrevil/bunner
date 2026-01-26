import type { ResourceWasteFinding } from '../types';
import type { ParsedFile } from './oxc-wrapper';
import type { DefMeta, FunctionBodyAnalysis, OxcNode, OxcNodeValue } from './types';

import { OxcCFGBuilder } from './cfg-builder';
import { createBitSet, type IBitSet } from './dataflow';
import { getLineColumn } from './oxc-wrapper';
import { collectVariables } from './variable-collector';

const isOxcNode = (value: OxcNodeValue | undefined): value is OxcNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOxcNodeArray = (value: OxcNodeValue | undefined): value is ReadonlyArray<OxcNodeValue> => Array.isArray(value);

const getNodeType = (node: OxcNode): string | null => {
  return typeof node.type === 'string' ? node.type : null;
};

const isFunctionNode = (node: OxcNodeValue | undefined): boolean => {
  if (!isOxcNode(node)) {
    return false;
  }

  // OXC AST node types we want to treat as "function boundaries" for analysis.
  return getNodeType(node) === 'ArrowFunctionExpression';
};

const collectLocalVarIndexes = (functionNode: OxcNode): Map<string, number> => {
  const names = new Set<string>();
  const params = isOxcNodeArray(functionNode.params) ? functionNode.params : [];

  for (const param of params) {
    if (isOxcNode(param) && getNodeType(param) === 'Identifier' && typeof param.name === 'string') {
      names.add(param.name);
    }
  }

  const bodyNode = functionNode.body;
  const bodyUsages = collectVariables(bodyNode, { includeNestedFunctions: false });

  for (const usage of bodyUsages) {
    if (usage.isWrite && usage.writeKind === 'declaration') {
      names.add(usage.name);
    }
  }

  const out = new Map<string, number>();
  let index = 0;

  for (const name of names) {
    out.set(name, index);

    index += 1;
  }

  return out;
};

const unionAll = (sets: readonly IBitSet[], empty: IBitSet): IBitSet => {
  let current = empty;

  for (const set of sets) {
    current = current.union(set);
  }

  return current;
};

const analyzeFunctionBody = (
  bodyNode: OxcNodeValue | undefined,
  localIndexByName: Map<string, number>,
): FunctionBodyAnalysis => {
  const cfgBuilder = new OxcCFGBuilder();
  const built = cfgBuilder.buildFunctionBody(bodyNode);
  const nodeCount = built.cfg.nodeCount;
  const nodePayloads = built.nodePayloads;
  const defsByVarIndex: number[][] = Array.from({ length: localIndexByName.size }, () => []);
  const defMetaById: DefMeta[] = [];
  const genDefIdsByNode: number[][] = Array.from({ length: nodeCount }, () => []);
  const useVarIndexesByNode: number[][] = Array.from({ length: nodeCount }, () => []);
  const writeVarIndexesByNode: number[][] = Array.from({ length: nodeCount }, () => []);

  for (let nodeId = 0; nodeId < nodeCount; nodeId += 1) {
    const payload = nodePayloads[nodeId];

    if (!payload) {
      continue;
    }

    const usages = collectVariables(payload, { includeNestedFunctions: false });
    const useIndexes = new Set<number>();
    const writeIndexes = new Set<number>();

    for (const usage of usages) {
      const varIndex = localIndexByName.get(usage.name);

      if (typeof varIndex !== 'number') {
        continue;
      }

      if (usage.isRead) {
        useIndexes.add(varIndex);
      }

      if (usage.isWrite) {
        writeIndexes.add(varIndex);

        const defId = defMetaById.length;
        const meta: DefMeta = usage.writeKind
          ? {
              name: usage.name,
              varIndex,
              location: usage.location,
              writeKind: usage.writeKind,
            }
          : {
              name: usage.name,
              varIndex,
              location: usage.location,
            };

        defMetaById.push(meta);

        defsByVarIndex[varIndex]?.push(defId);
        genDefIdsByNode[nodeId]?.push(defId);
      }
    }

    useVarIndexesByNode[nodeId] = [...useIndexes];
    writeVarIndexesByNode[nodeId] = [...writeIndexes];
  }

  const defCount = defMetaById.length;
  const empty = createBitSet(defCount);
  const genByNode: IBitSet[] = Array.from({ length: nodeCount }, () => createBitSet(defCount));
  const killByNode: IBitSet[] = Array.from({ length: nodeCount }, () => createBitSet(defCount));
  const defsOfVar: IBitSet[] = Array.from({ length: localIndexByName.size }, () => createBitSet(defCount));

  for (let varIndex = 0; varIndex < defsByVarIndex.length; varIndex += 1) {
    const ids = defsByVarIndex[varIndex] ?? [];

    for (const defId of ids) {
      defsOfVar[varIndex]?.add(defId);
    }
  }

  for (let nodeId = 0; nodeId < nodeCount; nodeId += 1) {
    const genIds = genDefIdsByNode[nodeId] ?? [];

    for (const defId of genIds) {
      genByNode[nodeId]?.add(defId);
    }

    let kill = createBitSet(defCount);
    const writtenVars = writeVarIndexesByNode[nodeId] ?? [];

    for (const varIndex of writtenVars) {
      const defs = defsOfVar[varIndex];

      if (!defs) {
        continue;
      }

      kill = kill.union(defs);
    }

    killByNode[nodeId] = kill.subtract(genByNode[nodeId] ?? createBitSet(defCount));
  }

  const pred = built.cfg.buildAdjacency('backward');
  const inByNode: IBitSet[] = Array.from({ length: nodeCount }, () => createBitSet(defCount));
  const outByNode: IBitSet[] = Array.from({ length: nodeCount }, () => createBitSet(defCount));
  let changed = true;

  while (changed) {
    changed = false;

    for (let nodeId = 0; nodeId < nodeCount; nodeId += 1) {
      const predIds = pred[nodeId] ?? new Int32Array();
      const predOutSets: IBitSet[] = [];

      for (const p of predIds) {
        const out = outByNode[p];

        if (out) {
          predOutSets.push(out);
        }
      }

      const nextIn = unionAll(predOutSets, empty.clone());
      const nextOut = (genByNode[nodeId] ?? createBitSet(defCount)).union(
        nextIn.subtract(killByNode[nodeId] ?? createBitSet(defCount)),
      );

      if (!nextIn.equals(inByNode[nodeId] ?? createBitSet(defCount))) {
        inByNode[nodeId] = nextIn;
        changed = true;
      }

      if (!nextOut.equals(outByNode[nodeId] ?? createBitSet(defCount))) {
        outByNode[nodeId] = nextOut;
        changed = true;
      }
    }
  }

  let usedDefs = createBitSet(defCount);

  for (let nodeId = 0; nodeId < nodeCount; nodeId += 1) {
    const uses = useVarIndexesByNode[nodeId] ?? [];
    const reachingIn = inByNode[nodeId] ?? createBitSet(defCount);

    for (const varIndex of uses) {
      const defs = defsOfVar[varIndex];

      if (!defs) {
        continue;
      }

      usedDefs = usedDefs.union(reachingIn.intersect(defs));
    }
  }

  const overwrittenDefIds: boolean[] = Array.from({ length: defCount }, () => false);

  for (let nodeId = 0; nodeId < nodeCount; nodeId += 1) {
    const writtenVars = writeVarIndexesByNode[nodeId] ?? [];
    const reachingIn = inByNode[nodeId] ?? createBitSet(defCount);

    for (const varIndex of writtenVars) {
      const defs = defsOfVar[varIndex];

      if (!defs) {
        continue;
      }

      const killedHere = reachingIn.intersect(defs).subtract(genByNode[nodeId] ?? createBitSet(defCount));
      const killedIds = killedHere.toArray();

      for (const defId of killedIds) {
        overwrittenDefIds[defId] = true;
      }
    }
  }

  return {
    usedDefs,
    overwrittenDefIds,
    defs: defMetaById,
  };
};

export const detectResourceWasteOxc = (files: ParsedFile[]): ResourceWasteFinding[] => {
  const findings: ResourceWasteFinding[] = [];

  if (!Array.isArray(files)) {
    return [];
  }

  for (const file of files) {
    if (file.errors.length > 0) {
      continue;
    }

    const visit = (node: OxcNodeValue | undefined): void => {
      if (!isOxcNode(node)) {
        return;
      }

      const functionBody = node.body;

      if (isFunctionNode(node) && functionBody !== undefined && functionBody !== null) {
        const localIndexByName = collectLocalVarIndexes(node);

        if (localIndexByName.size === 0) {
          return;
        }

        const analysis = analyzeFunctionBody(functionBody, localIndexByName);
        const defs = analysis.defs;
        const usedDefs = analysis.usedDefs;
        const overwrittenDefIds = analysis.overwrittenDefIds;
        const varHasAnyUsedDef: boolean[] = Array.from({ length: localIndexByName.size }, () => false);

        for (let defId = 0; defId < defs.length; defId += 1) {
          if (!usedDefs.has(defId)) {
            continue;
          }

          const meta = defs[defId];

          if (meta) {
            varHasAnyUsedDef[meta.varIndex] = true;
          }
        }

        for (let defId = 0; defId < defs.length; defId += 1) {
          if (usedDefs.has(defId)) {
            continue;
          }

          const meta = defs[defId];

          if (!meta) {
            continue;
          }

          // If the variable is used via some other definition, suppress unused
          // declaration initializers to avoid noisy reports on common patterns.
          if (meta.writeKind === 'declaration' && varHasAnyUsedDef[meta.varIndex] === true) {
            continue;
          }

          const loc = getLineColumn(file.sourceText, meta.location);
          const isOverwritten = overwrittenDefIds[defId] === true;
          const kind = isOverwritten && meta.writeKind !== 'declaration' ? 'dead-store-overwrite' : 'dead-store';

          findings.push({
            kind,
            label: meta.name,
            filePath: file.filePath,
            span: {
              start: loc,
              end: {
                line: loc.line,
                column: loc.column + meta.name.length,
              },
            },
          });
        }
      }

      const entries = Object.entries(node);

      for (const [key, value] of entries) {
        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') {
          continue;
        }

        visit(value);
      }
    };

    visit(file.program);
  }

  return findings;
};

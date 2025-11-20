import type { HttpMethod } from '../../enums';
import { NodeKind } from '../enums';
import { RouterNode } from '../node/router-node';
import type { BuildStageName, PipelineStageConfig, RouterSnapshotMetadata } from '../types';

export interface BuildPipelineDependencies {
  stageConfig: PipelineStageConfig;
  routeCount: number;
  ensureRegexSafe: (patternSrc: string) => void;
  markRouteHints: (hasDynamicRoutes: boolean, hasWildcardRoutes: boolean) => void;
  initialWildcardRouteCount: number;
  initialWildcardMethodsByMethod: Record<number, true> | null;
  initialHasDynamicRoutes: boolean;
  initialHasWildcardRoutes: boolean;
  currentMetadata: RouterSnapshotMetadata;
}

export interface BuildPipelineResult {
  wildcardRouteCount: number;
  wildcardMethodsByMethod: Record<number, true> | null;
  hasDynamicRoutes: boolean;
  hasWildcardRoutes: boolean;
  metadata: RouterSnapshotMetadata;
}

export interface BuildPipeline {
  execute(root: RouterNode): BuildPipelineResult;
}

export const createBuildPipeline = (deps: BuildPipelineDependencies): BuildPipeline => {
  return {
    execute(root: RouterNode): BuildPipelineResult {
      let wildcardRouteCount = deps.initialWildcardRouteCount;
      let wildcardMethodsByMethod = deps.initialWildcardMethodsByMethod;
      let hasDynamicRoutes = deps.initialHasDynamicRoutes;
      let hasWildcardRoutes = deps.initialHasWildcardRoutes;
      let metadata = deps.currentMetadata;

      const stages: Array<{ name: BuildStageName; execute: () => void }> = [
        { name: 'compress-static', execute: () => compressStaticSubtree(root) },
        { name: 'param-priority', execute: () => sortAllParamChildren(root) },
        {
          name: 'wildcard-suffix',
          execute: () => {
            const stats = precomputeWildcardSuffixMetadata(root);
            wildcardRouteCount = stats.wildcardRouteCount;
            wildcardMethodsByMethod = stats.wildcardMethodsByMethod;
          },
        },
        { name: 'regex-safety', execute: () => validateRoutePatterns(root, deps.ensureRegexSafe) },
        {
          name: 'route-flags',
          execute: () => {
            const flags = recalculateRouteFlags(root);
            hasDynamicRoutes = flags.hasDynamicRoutes;
            hasWildcardRoutes = flags.hasWildcardRoutes;
            deps.markRouteHints(flags.hasDynamicRoutes, flags.hasWildcardRoutes);
          },
        },
        {
          name: 'snapshot-metadata',
          execute: () => {
            metadata = buildSnapshotMetadata({
              routeCount: deps.routeCount,
              hasDynamicRoutes,
              hasWildcardRoutes,
              wildcardRouteCount,
              wildcardMethodsByMethod,
            });
          },
        },
      ];

      for (const stage of stages) {
        if (!deps.stageConfig.build[stage.name]) {
          continue;
        }
        try {
          stage.execute();
        } catch (error) {
          throw new Error(`[bunner/router] Build stage '${stage.name}' failed: ${(error as Error).message}`);
        }
      }

      return {
        wildcardRouteCount,
        wildcardMethodsByMethod,
        hasDynamicRoutes,
        hasWildcardRoutes,
        metadata,
      };
    },
  };
};

const compressStaticSubtree = (entry: RouterNode): void => {
  const stack: RouterNode[] = [entry];
  const seen = new Set<RouterNode>();
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    for (const child of current.staticChildren.values()) {
      stack.push(child);
      collapseStaticNode(child);
    }
  }
};

const collapseStaticNode = (node: RouterNode): void => {
  if (node.kind !== NodeKind.Static) {
    return;
  }
  let cursor = node;
  const parts: string[] = node.segmentParts ? [...node.segmentParts] : [node.segment];
  while (
    cursor.kind === NodeKind.Static &&
    cursor.methods.byMethod.size === 0 &&
    cursor.paramChildren.length === 0 &&
    !cursor.wildcardChild &&
    cursor.staticChildren.size === 1
  ) {
    const next = cursor.staticChildren.values().next().value as RouterNode;
    if (next.kind !== NodeKind.Static) {
      break;
    }
    const nextParts = next.segmentParts ?? [next.segment];
    parts.push(...nextParts);
    cursor = next;
  }
  if (parts.length > 1) {
    node.segment = parts.join('/');
    node.segmentParts = parts;
    node.staticChildren = cursor.staticChildren;
    node.paramChildren = cursor.paramChildren;
    node.wildcardChild = cursor.wildcardChild;
    node.methods = cursor.methods;
  }
};

const sortAllParamChildren = (entry: RouterNode): void => {
  const stack: RouterNode[] = [entry];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.paramChildren.length > 1) {
      node.paramChildren.sort((a, b) => scoreParamNode(b) - scoreParamNode(a));
    }
    for (const child of node.staticChildren.values()) {
      stack.push(child);
    }
    for (const paramChild of node.paramChildren) {
      stack.push(paramChild);
    }
    if (node.wildcardChild) {
      stack.push(node.wildcardChild);
    }
  }
};

const scoreParamNode = (node: RouterNode): number => {
  let score = 0;
  if (node.pattern) {
    score += 2;
  }
  if (node.wildcardChild) {
    score -= 1;
  }
  if (node.methods.byMethod.size) {
    score += 1;
  }
  const len = node.segment.length;
  return score + (len ? 1 / len : 0);
};

const validateRoutePatterns = (entry: RouterNode, ensureRegexSafe: (patternSrc: string) => void): void => {
  const stack: RouterNode[] = [entry];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.patternSource) {
      ensureRegexSafe(node.patternSource);
    }
    if (node.wildcardChild) {
      stack.push(node.wildcardChild);
    }
    for (const child of node.paramChildren) {
      stack.push(child);
    }
    for (const child of node.staticChildren.values()) {
      stack.push(child);
    }
  }
};

const precomputeWildcardSuffixMetadata = (
  entry: RouterNode,
): { wildcardRouteCount: number; wildcardMethodsByMethod: Record<number, true> | null } => {
  const perMethod: Record<number, true> = Object.create(null);
  let wildcardRouteCount = 0;
  const stack: RouterNode[] = [entry];
  while (stack.length) {
    const node = stack.pop()!;
    const wildcard = node.wildcardChild;
    if (wildcard) {
      for (const method of wildcard.methods.byMethod.keys()) {
        perMethod[method as number] = true;
        wildcardRouteCount++;
      }
      stack.push(wildcard);
    }
    for (const child of node.paramChildren) {
      stack.push(child);
    }
    for (const child of node.staticChildren.values()) {
      stack.push(child);
    }
  }
  return {
    wildcardRouteCount,
    wildcardMethodsByMethod: wildcardRouteCount ? perMethod : null,
  };
};

const recalculateRouteFlags = (entry: RouterNode): { hasWildcardRoutes: boolean; hasDynamicRoutes: boolean } => {
  let hasWildcardRoutes = false;
  let hasDynamicRoutes = false;
  const stack: RouterNode[] = [entry];
  while (stack.length) {
    const node = stack.pop()!;
    if (node.paramChildren.length) {
      hasDynamicRoutes = true;
    }
    if (node.wildcardChild) {
      hasWildcardRoutes = true;
      hasDynamicRoutes = true;
      stack.push(node.wildcardChild);
    }
    for (const child of node.paramChildren) {
      stack.push(child);
    }
    for (const child of node.staticChildren.values()) {
      stack.push(child);
    }
  }
  return { hasWildcardRoutes, hasDynamicRoutes };
};

interface SnapshotInput {
  routeCount: number;
  hasDynamicRoutes: boolean;
  hasWildcardRoutes: boolean;
  wildcardRouteCount: number;
  wildcardMethodsByMethod: Record<number, true> | null;
}

const buildSnapshotMetadata = (input: SnapshotInput): RouterSnapshotMetadata => {
  const methodsWithWildcard: HttpMethod[] = input.wildcardMethodsByMethod
    ? Object.keys(input.wildcardMethodsByMethod)
        .map(code => Number(code) as HttpMethod)
        .sort((a, b) => a - b)
    : [];
  return Object.freeze({
    totalRoutes: input.routeCount,
    hasDynamicRoutes: input.hasDynamicRoutes,
    hasWildcardRoutes: input.hasWildcardRoutes,
    wildcardRouteCount: input.wildcardRouteCount,
    methodsWithWildcard,
    builtAt: Date.now(),
  });
};

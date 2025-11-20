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

      const stageExecutors: Record<BuildStageName, () => void> = {
        'compress-static': () => compressStaticSubtree(root),
        'param-priority': () => sortAllParamChildren(root),
        'wildcard-suffix': () => {
          if (!hasWildcardRoutes && !deps.initialWildcardRouteCount) {
            return;
          }
          const stats = precomputeWildcardSuffixMetadata(root);
          wildcardRouteCount = stats.wildcardRouteCount;
          wildcardMethodsByMethod = stats.wildcardMethodsByMethod;
        },
        'regex-safety': () => validateRoutePatterns(root, deps.ensureRegexSafe),
        'route-flags': () => {
          const flags = recalculateRouteFlags(root);
          hasDynamicRoutes = flags.hasDynamicRoutes;
          hasWildcardRoutes = flags.hasWildcardRoutes;
          deps.markRouteHints(flags.hasDynamicRoutes, flags.hasWildcardRoutes);
        },
        'snapshot-metadata': () => {
          metadata = buildSnapshotMetadata({
            routeCount: deps.routeCount,
            hasDynamicRoutes,
            hasWildcardRoutes,
            wildcardRouteCount,
            wildcardMethodsByMethod,
          });
        },
      };

      const enabledStages = (Object.keys(stageExecutors) as BuildStageName[]).filter(name => deps.stageConfig.build[name]);
      for (const name of enabledStages) {
        try {
          stageExecutors[name]();
        } catch (error) {
          throw new Error(`[bunner/router] Build stage '${name}' failed: ${(error as Error).message}`);
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

const STACK_POOL: RouterNode[][] = [];
const MAX_STACK_POOL_SIZE = 4;

const acquireNodeStack = (): RouterNode[] => {
  const stack = STACK_POOL.pop();
  if (stack) {
    stack.length = 0;
    return stack;
  }
  return [];
};

const releaseNodeStack = (stack: RouterNode[]): void => {
  stack.length = 0;
  if (STACK_POOL.length < MAX_STACK_POOL_SIZE) {
    STACK_POOL.push(stack);
  }
};

const compressStaticSubtree = (entry: RouterNode): void => {
  const stack = acquireNodeStack();
  stack.push(entry);
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of current.staticChildren.values()) {
      stack.push(child);
      collapseStaticNode(child);
    }
  }
  releaseNodeStack(stack);
};

const collapseStaticNode = (node: RouterNode): void => {
  if (node.kind !== NodeKind.Static) {
    return;
  }
  let cursor = node;
  let combinedParts: string[] | undefined;
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
    if (!combinedParts) {
      combinedParts = node.segmentParts ? [...node.segmentParts] : [node.segment];
    }
    if (next.segmentParts) {
      combinedParts.push(...next.segmentParts);
    } else {
      combinedParts.push(next.segment);
    }
    cursor = next;
  }
  if (combinedParts && combinedParts.length > 1) {
    node.segment = combinedParts.join('/');
    node.segmentParts = combinedParts;
    node.staticChildren = cursor.staticChildren;
    node.paramChildren = cursor.paramChildren;
    node.wildcardChild = cursor.wildcardChild;
    node.methods = cursor.methods;
  }
};

const sortAllParamChildren = (entry: RouterNode): void => {
  const stack = acquireNodeStack();
  stack.push(entry);
  while (stack.length) {
    const node = stack.pop()!;
    const paramChildren = node.paramChildren;
    if (paramChildren.length > 1) {
      sortParamChildList(paramChildren);
    }
    for (const child of node.staticChildren.values()) {
      stack.push(child);
    }
    for (const paramChild of paramChildren) {
      stack.push(paramChild);
    }
    if (node.wildcardChild) {
      stack.push(node.wildcardChild);
    }
  }
  releaseNodeStack(stack);
};

const compareParamChildren = (a: RouterNode, b: RouterNode): number => {
  const scoreA = a.paramSortScore ?? 0;
  const scoreB = b.paramSortScore ?? 0;
  return scoreB - scoreA;
};

const PARAM_CHILD_INSERTION_THRESHOLD = 4;

const sortParamChildList = (list: RouterNode[]): void => {
  if (list.length <= 1) {
    return;
  }
  if (list.length <= PARAM_CHILD_INSERTION_THRESHOLD) {
    insertionSortParamChildren(list);
    return;
  }
  for (const child of list) {
    child.paramSortScore = scoreParamNode(child);
  }
  list.sort(compareParamChildren);
  for (const child of list) {
    child.paramSortScore = undefined;
  }
};

const insertionSortParamChildren = (list: RouterNode[]): void => {
  if (list.length <= 1) {
    return;
  }
  const scores = new Array<number>(list.length);
  for (let i = 0; i < list.length; i++) {
    scores[i] = scoreParamNode(list[i]!);
  }
  for (let i = 1; i < list.length; i++) {
    const current = list[i]!;
    const currentScore = scores[i]!;
    let j = i - 1;
    while (j >= 0 && scores[j]! < currentScore) {
      list[j + 1] = list[j]!;
      scores[j + 1] = scores[j]!;
      j--;
    }
    list[j + 1] = current;
    scores[j + 1] = currentScore;
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
  const stack = acquireNodeStack();
  stack.push(entry);
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
  releaseNodeStack(stack);
};

const precomputeWildcardSuffixMetadata = (
  entry: RouterNode,
): { wildcardRouteCount: number; wildcardMethodsByMethod: Record<number, true> | null } => {
  const perMethod: Record<number, true> = Object.create(null);
  let wildcardRouteCount = 0;
  const stack = acquireNodeStack();
  stack.push(entry);
  while (stack.length) {
    const node = stack.pop()!;
    const wildcard = node.wildcardChild;
    if (wildcard) {
      const methods = wildcard.methods.byMethod;
      if (methods.size) {
        wildcardRouteCount += methods.size;
        for (const method of methods.keys()) {
          perMethod[method as number] = true;
        }
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
  releaseNodeStack(stack);
  return {
    wildcardRouteCount,
    wildcardMethodsByMethod: wildcardRouteCount ? perMethod : null,
  };
};

const recalculateRouteFlags = (entry: RouterNode): { hasWildcardRoutes: boolean; hasDynamicRoutes: boolean } => {
  let hasWildcardRoutes = false;
  let hasDynamicRoutes = false;
  const stack = acquireNodeStack();
  stack.push(entry);
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
  releaseNodeStack(stack);
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

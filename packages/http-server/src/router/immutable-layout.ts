import type { HttpMethod } from '../enums';
import type { RouteKey } from '../types';

import { NodeKind } from './enums';
import type { RouterNode } from './node';

export interface SerializedStaticChild {
  readonly segment: string;
  readonly target: number;
}

export interface SerializedParamChild {
  readonly target: number;
}

export interface SerializedMethodEntry {
  readonly method: HttpMethod;
  readonly key: RouteKey;
}

export interface SerializedPattern {
  readonly source: string;
  readonly flags: string;
}

export interface SerializedNodeRecord {
  readonly kind: NodeKind;
  readonly segment: string;
  readonly staticRangeStart: number;
  readonly staticRangeCount: number;
  readonly paramRangeStart: number;
  readonly paramRangeCount: number;
  readonly wildcardChild: number;
  readonly methodsRangeStart: number;
  readonly methodsRangeCount: number;
  readonly segmentPartsIndex: number;
  readonly patternIndex: number;
  readonly wildcardOrigin: 'star' | 'multi' | null;
}

export interface ImmutableRouterLayout {
  readonly rootIndex: number;
  readonly nodes: ReadonlyArray<SerializedNodeRecord>;
  readonly staticChildren: ReadonlyArray<SerializedStaticChild>;
  readonly paramChildren: ReadonlyArray<SerializedParamChild>;
  readonly methods: ReadonlyArray<SerializedMethodEntry>;
  readonly segmentChains: ReadonlyArray<ReadonlyArray<string>>;
  readonly patterns: ReadonlyArray<SerializedPattern>;
}

type MutableRecord = {
  kind: NodeKind;
  segment: string;
  staticRangeStart: number;
  staticRangeCount: number;
  paramRangeStart: number;
  paramRangeCount: number;
  wildcardChild: number;
  methodsRangeStart: number;
  methodsRangeCount: number;
  segmentPartsIndex: number;
  patternIndex: number;
  wildcardOrigin: 'star' | 'multi' | null;
};

type MutableStaticChild = {
  segment: string;
  target: number;
};

type MutableParamChild = {
  target: number;
};

type MutableMethodEntry = {
  method: HttpMethod;
  key: RouteKey;
};

type MutablePattern = {
  source: string;
  flags: string;
};

export function buildImmutableLayout(root: RouterNode): ImmutableRouterLayout {
  const nodes: MutableRecord[] = [];
  const staticChildren: MutableStaticChild[] = [];
  const paramChildren: MutableParamChild[] = [];
  const methods: MutableMethodEntry[] = [];
  const segmentChains: string[][] = [];
  const patterns: MutablePattern[] = [];

  const pushSegmentChain = (parts: string[]): number => {
    segmentChains.push(parts.slice());
    return segmentChains.length - 1;
  };

  const pushPattern = (source: string, flags: string): number => {
    patterns.push({ source, flags });
    return patterns.length - 1;
  };

  const visit = (node: RouterNode): number => {
    const record: MutableRecord = {
      kind: node.kind,
      segment: node.segment,
      staticRangeStart: staticChildren.length,
      staticRangeCount: 0,
      paramRangeStart: paramChildren.length,
      paramRangeCount: 0,
      wildcardChild: -1,
      methodsRangeStart: methods.length,
      methodsRangeCount: 0,
      segmentPartsIndex: node.segmentParts ? pushSegmentChain(node.segmentParts) : -1,
      patternIndex: node.patternSource ? pushPattern(node.patternSource, node.pattern?.flags ?? '') : -1,
      wildcardOrigin: node.wildcardOrigin ?? null,
    };
    const nodeIndex = nodes.push(record) - 1;

    const methodStart = methods.length;
    if (node.methods.byMethod.size) {
      const sorted = Array.from(node.methods.byMethod.entries()).sort((a, b) => a[0] - b[0]);
      for (const [method, key] of sorted) {
        methods.push({ method, key });
      }
    }
    record.methodsRangeStart = methodStart;
    record.methodsRangeCount = methods.length - methodStart;

    const staticStart = staticChildren.length;
    if (node.staticChildren.size) {
      const entries = Array.from(node.staticChildren.entries()).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
      for (const [segment, child] of entries) {
        const childIndex = visit(child);
        staticChildren.push({ segment, target: childIndex });
      }
    }
    record.staticRangeCount = staticChildren.length - staticStart;

    const paramStart = paramChildren.length;
    if (node.paramChildren.length) {
      for (const child of node.paramChildren) {
        const childIndex = visit(child);
        paramChildren.push({ target: childIndex });
      }
    }
    record.paramRangeCount = paramChildren.length - paramStart;

    if (node.wildcardChild) {
      record.wildcardChild = visit(node.wildcardChild);
    }

    return nodeIndex;
  };

  const rootIndex = visit(root);

  return Object.freeze({
    rootIndex,
    nodes: freezeRecords(nodes),
    staticChildren: freezeObjects(staticChildren),
    paramChildren: freezeObjects(paramChildren),
    methods: freezeObjects(methods),
    segmentChains: freezeNested(segmentChains),
    patterns: freezeObjects(patterns),
  });
}

function freezeRecords(records: MutableRecord[]): ReadonlyArray<SerializedNodeRecord> {
  return Object.freeze(records.map(record => Object.freeze({ ...record })));
}

function freezeObjects<T extends Record<string, unknown>>(items: T[]): ReadonlyArray<T> {
  return Object.freeze(items.map(item => Object.freeze({ ...item })));
}

function freezeNested(items: string[][]): ReadonlyArray<ReadonlyArray<string>> {
  return Object.freeze(items.map(entry => Object.freeze(entry.slice())));
}

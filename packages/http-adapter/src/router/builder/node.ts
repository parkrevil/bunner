import { NodeKind } from '../schema';

import { StaticChildMap } from './static-child-map';
import type { RouteMethods } from './types';

export class Node {
  kind: NodeKind;
  segment: string;

  staticChildren: StaticChildMap = new StaticChildMap();
  paramChildren: Node[] = [];
  wildcardChild?: Node;
  methods: RouteMethods = { byMethod: new Map() };

  pattern?: RegExp;
  patternSource?: string;
  patternTester?: (value: string) => boolean;
  segmentParts?: string[];
  wildcardOrigin?: 'star' | 'multi' | 'zero';
  paramSortScore?: number;

  constructor(kind: NodeKind, segment: string) {
    this.kind = kind;
    this.segment = segment;
  }

  resetState(kind: NodeKind, segment: string): void {
    this.kind = kind;
    this.segment = segment;
    this.staticChildren = new StaticChildMap();

    if (this.paramChildren.length) {
      this.paramChildren.length = 0;
    }

    this.wildcardChild = undefined;

    this.methods.byMethod.clear();

    this.pattern = undefined;
    this.patternSource = undefined;
    this.patternTester = undefined;
    this.segmentParts = undefined;
    this.wildcardOrigin = undefined;
    this.paramSortScore = undefined;
  }
}

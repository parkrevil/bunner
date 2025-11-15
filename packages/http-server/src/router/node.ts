import { NodeKind } from './enums';
import type { RouteMethods } from './interfaces';

export class RouterNode {
  kind: NodeKind;
  /**
   * For static nodes, the exact segment value (without '/').
   * For param nodes, the param name (without ':').
   * For wildcard nodes, always "*".
   */
  segment: string;

  // Children: static -> Map for O(1) lookups
  staticChildren: Map<string, RouterNode> = new Map();
  staticChildrenVersion = 0;
  // Multiple param variants at same position (e.g., with different regex constraints)
  paramChildren: RouterNode[] = [];
  wildcardChild?: RouterNode; // "*" catch-all (must be terminal)
  cachedStaticChildren?: RouterNode[];
  cachedStaticChildrenVersion = -1;

  // Methods assigned at this exact path (leaf)
  methods: RouteMethods = { byMethod: new Map(), version: 0 };

  // For Param nodes: optional compiled regex constraint
  pattern?: RegExp;
  patternSource?: string;
  // For Static nodes: optional precomputed parts when compressed (e.g., 'a/b/c' -> ['a','b','c'])
  segmentParts?: string[];
  compressionDepth = 1;

  constructor(kind: NodeKind, segment: string) {
    this.kind = kind;
    this.segment = segment;
  }
}

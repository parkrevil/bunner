import { NodeKind } from '../enums';
import type { RouteMethods } from '../interfaces';

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
  // Multiple param variants at same position (e.g., with different regex constraints)
  paramChildren: RouterNode[] = [];
  wildcardChild?: RouterNode; // "*" catch-all (must be terminal)

  // Methods assigned at this exact path (leaf)
  methods: RouteMethods = { byMethod: new Map() };

  // For Param nodes: optional compiled regex constraint
  pattern?: RegExp;
  patternSource?: string;
  patternTester?: (value: string) => boolean;
  // For Static nodes: optional precomputed parts when compressed (e.g., 'a/b/c' -> ['a','b','c'])
  segmentParts?: string[];
  // For Wildcard nodes: remember whether they originated from '*' / ':name+' / ':name*'
  wildcardOrigin?: 'star' | 'multi' | 'zero';
  // Build-stage hint for cached param sort score
  paramSortScore?: number;

  constructor(kind: NodeKind, segment: string) {
    this.kind = kind;
    this.segment = segment;
    this.resetState(kind, segment);
  }

  resetState(kind: NodeKind, segment: string): void {
    this.kind = kind;
    this.segment = segment;
    if (this.staticChildren.size) {
      this.staticChildren.clear();
    }
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

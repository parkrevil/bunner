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

  // Children: static -> Map for O(1) lookups, plus single param/wildcard child for precedence control
  staticChildren: Map<string, RouterNode> = new Map();
  paramChild?: RouterNode; // ":param"
  wildcardChild?: RouterNode; // "*" catch-all (must be terminal)

  // Methods assigned at this exact path (leaf)
  methods: RouteMethods = { byMethod: new Map() };

  constructor(kind: NodeKind, segment: string) {
    this.kind = kind;
    this.segment = segment;
  }
}

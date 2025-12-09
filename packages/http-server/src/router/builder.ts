import {
  HttpMethod,
  NodeKind,
  NODE_MASK_KIND,
  NODE_MASK_METHOD_COUNT,
  NODE_MASK_PARAM_COUNT,
  NODE_MASK_WILDCARD_ORIGIN,
  NODE_OFFSET_MATCH_FUNC,
  NODE_OFFSET_META,
  NODE_OFFSET_METHODS_PTR,
  NODE_OFFSET_METHOD_MASK,
  NODE_OFFSET_PARAM_CHILD_PTR,
  NODE_OFFSET_STATIC_CHILD_COUNT,
  NODE_OFFSET_STATIC_CHILD_PTR,
  NODE_OFFSET_WILDCARD_CHILD_PTR,
  NODE_SHIFT_METHOD_COUNT,
  NODE_SHIFT_PARAM_COUNT,
  NODE_SHIFT_WILDCARD_ORIGIN,
  NODE_STRIDE,
} from './schema';
import type { BinaryRouterLayout, SerializedPattern } from './schema';
import type { OptionalParamBehavior, RegexSafetyOptions, RouteKey, RouteParams } from './types';

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

export interface BuilderConfig {
  regexSafety?: RegexSafetyOptions;
  regexAnchorPolicy?: 'warn' | 'error' | 'silent';
  optionalParamDefaults?: OptionalParamDefaults;
  strictParamNames?: boolean;
}

export interface RouteMethods {
  byMethod: Map<HttpMethod, RouteKey>;
}

// ----------------------------------------------------------------------
// Node Class (Internal)
// ----------------------------------------------------------------------

class Node {
  kind: NodeKind;
  segment: string;

  staticChildren: StaticChildStore = new StaticChildStore();
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
    this.staticChildren = new StaticChildStore();
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

// ----------------------------------------------------------------------
// StaticChildStore (Internal)
// ----------------------------------------------------------------------

const INLINE_THRESHOLD = 4;
type Entry = [string, Node];
interface SortedChildArrays {
  segments: string[];
  nodes: Node[];
  fingerprints: number[];
}

class StaticChildStore implements Iterable<Entry> {
  private inlineKeys: string[] | null = null;
  private inlineValues: Node[] | null = null;
  private inlineCount = 0;
  private sorted?: SortedChildArrays;

  static fromEntries(entries: Iterable<Entry>): StaticChildStore {
    const store = new StaticChildStore();
    for (const [segment, node] of entries) {
      store.set(segment, node);
    }
    return store;
  }

  get size(): number {
    if (this.sorted) {
      return this.sorted.segments.length;
    }
    return this.inlineCount;
  }

  get(segment: string): Node | undefined {
    if (this.sorted) {
      return this.getFromSorted(segment);
    }
    if (!this.inlineKeys || !this.inlineValues) {
      return undefined;
    }
    for (let i = 0; i < this.inlineCount; i++) {
      if (this.inlineKeys[i] === segment) {
        return this.inlineValues[i];
      }
    }
    return undefined;
  }

  set(segment: string, node: Node): this {
    if (this.sorted) {
      this.setInSorted(segment, node);
      return this;
    }
    if (!this.inlineKeys || !this.inlineValues) {
      this.inlineKeys = [];
      this.inlineValues = [];
    }
    for (let i = 0; i < this.inlineCount; i++) {
      if (this.inlineKeys[i] === segment) {
        this.inlineValues[i] = node;
        return this;
      }
    }
    this.inlineKeys.push(segment);
    this.inlineValues.push(node);
    this.inlineCount++;
    if (this.inlineCount > INLINE_THRESHOLD) {
      this.promote();
    }
    return this;
  }

  clear(): void {
    if (this.sorted) {
      this.sorted.segments.length = 0;
      this.sorted.nodes.length = 0;
      this.sorted.fingerprints.length = 0;
    } else if (this.inlineKeys && this.inlineValues) {
      this.inlineKeys.length = 0;
      this.inlineValues.length = 0;
    }
    this.inlineCount = 0;
    this.sorted = undefined;
  }

  values(): IterableIterator<Node> {
    if (this.sorted) {
      return this.iterateSortedValues();
    }
    return this.iterateInlineValues();
  }

  keys(): IterableIterator<string> {
    if (this.sorted) {
      return this.iterateSortedKeys();
    }
    return this.iterateInlineKeys();
  }

  entries(): IterableIterator<Entry> {
    if (this.sorted) {
      return this.iterateSortedEntries();
    }
    return this.iterateInlineEntries();
  }

  [Symbol.iterator](): IterableIterator<Entry> {
    return this.entries();
  }

  // --- Private Helpers ---
  private promote(): void {
    if (this.sorted || !this.inlineKeys || !this.inlineValues) {
      return;
    }
    const entries: Array<{ segment: string; node: Node; fingerprint: number }> = new Array(this.inlineCount);
    for (let i = 0; i < this.inlineCount; i++) {
      entries[i] = {
        segment: this.inlineKeys[i]!,
        node: this.inlineValues[i]!,
        fingerprint: fingerprintSegment(this.inlineKeys[i]!),
      };
    }
    entries.sort((a, b) => compareFingerprintAndSegment(a.fingerprint, a.segment, b.fingerprint, b.segment));
    const segments = new Array<string>(entries.length);
    const nodes = new Array<Node>(entries.length);
    const fingerprints = new Array<number>(entries.length);
    for (let i = 0; i < entries.length; i++) {
      segments[i] = entries[i]!.segment;
      nodes[i] = entries[i]!.node;
      fingerprints[i] = entries[i]!.fingerprint;
    }
    this.sorted = { segments, nodes, fingerprints };
    this.inlineKeys = null;
    this.inlineValues = null;
  }

  private setInSorted(segment: string, node: Node): void {
    const arrays = this.sorted!;
    const fp = fingerprintSegment(segment);
    const index = this.findSortedIndex(segment, fp);
    if (index >= 0) {
      arrays.nodes[index] = node;
      arrays.segments[index] = segment;
      arrays.fingerprints[index] = fp;
      return;
    }
    const insertAt = ~index;
    arrays.segments.splice(insertAt, 0, segment);
    arrays.nodes.splice(insertAt, 0, node);
    arrays.fingerprints.splice(insertAt, 0, fp);
  }

  private getFromSorted(segment: string): Node | undefined {
    const arrays = this.sorted!;
    const index = this.findSortedIndex(segment, fingerprintSegment(segment));
    if (index >= 0) {
      return arrays.nodes[index];
    }
    return undefined;
  }

  private findSortedIndex(segment: string, fp: number): number {
    const arrays = this.sorted!;
    let low = 0;
    let high = arrays.segments.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const cmp = compareFingerprintAndSegment(fp, segment, arrays.fingerprints[mid]!, arrays.segments[mid]!);
      if (cmp === 0) {
        return mid;
      }
      if (cmp < 0) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return ~low;
  }

  private *iterateInlineEntries(): IterableIterator<Entry> {
    if (!this.inlineKeys || !this.inlineValues) {
      return;
    }
    for (let i = 0; i < this.inlineCount; i++) {
      yield [this.inlineKeys[i]!, this.inlineValues[i]!] as Entry;
    }
  }
  private *iterateInlineKeys(): IterableIterator<string> {
    if (!this.inlineKeys) {
      return;
    }
    for (let i = 0; i < this.inlineCount; i++) {
      yield this.inlineKeys[i]!;
    }
  }
  private *iterateInlineValues(): IterableIterator<Node> {
    if (!this.inlineValues) {
      return;
    }
    for (let i = 0; i < this.inlineCount; i++) {
      yield this.inlineValues[i]!;
    }
  }
  private *iterateSortedEntries(): IterableIterator<Entry> {
    const arrays = this.sorted;
    if (!arrays) {
      return;
    }
    for (let i = 0; i < arrays.segments.length; i++) {
      yield [arrays.segments[i]!, arrays.nodes[i]!] as Entry;
    }
  }
  private *iterateSortedKeys(): IterableIterator<string> {
    const arrays = this.sorted;
    if (!arrays) {
      return;
    }
    for (let i = 0; i < arrays.segments.length; i++) {
      yield arrays.segments[i]!;
    }
  }
  private *iterateSortedValues(): IterableIterator<Node> {
    const arrays = this.sorted;
    if (!arrays) {
      return;
    }
    for (let i = 0; i < arrays.nodes.length; i++) {
      yield arrays.nodes[i]!;
    }
  }
}

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
function fingerprintSegment(segment: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < segment.length; i++) {
    hash ^= segment.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}
function compareFingerprintAndSegment(fpA: number, segA: string, fpB: number, segB: string): number {
  if (fpA !== fpB) {
    return fpA - fpB;
  }
  if (segA === segB) {
    return 0;
  }
  return segA < segB ? -1 : 1;
}

// ----------------------------------------------------------------------
// Node Pool (Internal)
// ----------------------------------------------------------------------

const NODE_POOL_STACK: Node[] = [];
function acquireNode(kind: NodeKind, segment: string): Node {
  const node = NODE_POOL_STACK.pop();
  if (node) {
    node.resetState(kind, segment);
    return node;
  }
  return new Node(kind, segment);
}

// ----------------------------------------------------------------------
// OptionalParamDefaults (Exposed)
// ----------------------------------------------------------------------

export class OptionalParamDefaults {
  private readonly behavior: OptionalParamBehavior | undefined;
  private readonly defaults = new Map<RouteKey, readonly string[]>();

  constructor(behavior: OptionalParamBehavior | undefined) {
    this.behavior = behavior;
  }

  record(key: RouteKey, names: readonly string[]): void {
    if (!names.length) {
      return;
    }
    this.defaults.set(key, names.slice());
  }

  apply(key: RouteKey, params: RouteParams): void {
    if (this.behavior === 'omit' || !this.behavior) {
      return;
    }
    const defaults = this.defaults.get(key);
    if (!defaults?.length) {
      return;
    }
    for (const name of defaults) {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        continue;
      }
      params[name] = this.behavior === 'setEmptyString' ? '' : undefined;
    }
  }
}

// ----------------------------------------------------------------------
// Regex Safety (Internal)
// ----------------------------------------------------------------------

const BACKREFERENCE_PATTERN = /\\(?:\d+|k<[^>]+>)/;

// ----------------------------------------------------------------------
// Builder (Main Class)
// ----------------------------------------------------------------------

const START_ANCHOR_PATTERN = /^\^/;
const END_ANCHOR_PATTERN = /\$$/;

export class Builder {
  public root: Node;
  public readonly config: BuilderConfig;
  private readonly compiledPatternCache = new Map<string, RegExp>();
  private readonly globalParamNames = new Set<string>();

  constructor(config: BuilderConfig) {
    this.config = config;
    this.root = acquireNode(NodeKind.Static, '/');
  }

  add(method: HttpMethod, segments: string[], key: RouteKey): void {
    this.addSegments(this.root, 0, new Set<string>(), [], method, key, segments);
  }

  build(): BinaryRouterLayout {
    // 1. Linearize Nodes (BFS)
    const nodes: Node[] = [];
    const nodeToIndex = new Map<Node, number>();
    const queue: Node[] = [this.root];

    while (queue.length) {
      const node = queue.shift()!;
      if (nodeToIndex.has(node)) {
        continue;
      }
      nodeToIndex.set(node, nodes.length);
      nodes.push(node);

      if (node.staticChildren.size) {
        for (const child of node.staticChildren.values()) {
          queue.push(child);
        }
      }
      for (const child of node.paramChildren) {
        queue.push(child);
      }
      if (node.wildcardChild) {
        queue.push(node.wildcardChild);
      }
    }

    // Buffers and String Tables
    const nodeBuffer = new Uint32Array(nodes.length * NODE_STRIDE);
    const staticChildrenList: number[] = [];
    const paramChildrenList: number[] = [];
    const paramsList: number[] = [];
    const methodsList: number[] = [0];
    const stringList: string[] = [];
    const stringMap = new Map<string, number>();
    const patterns: SerializedPattern[] = [];
    const patternMap = new Map<string, number>();

    const getStringId = (str: string): number => {
      let id = stringMap.get(str);
      if (id === undefined) {
        id = stringList.length;
        stringList.push(str);
        stringMap.set(str, id);
      }
      return id;
    };

    const getPatternId = (source: string, flags: string): number => {
      const key = `${flags}|${source}`;
      let id = patternMap.get(key);
      if (id === undefined) {
        id = patterns.length;
        patterns.push({ source, flags });
        patternMap.set(key, id);
      }
      return id;
    };

    // 2. Build Nodes in Buffer
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const base = i * NODE_STRIDE;

      // Meta
      const kindCode = node.kind === NodeKind.Static ? 0 : node.kind === NodeKind.Param ? 1 : 2;
      let wildcardOriginCode = 0;
      if (node.wildcardOrigin === 'multi') {
        wildcardOriginCode = 1;
      } else if (node.wildcardOrigin === 'zero') {
        wildcardOriginCode = 2;
      }

      const paramCount = node.paramChildren.length;
      const methodCount = node.methods.byMethod.size;

      let meta = kindCode & NODE_MASK_KIND;
      meta |= (wildcardOriginCode << NODE_SHIFT_WILDCARD_ORIGIN) & NODE_MASK_WILDCARD_ORIGIN;
      meta |= (paramCount << NODE_SHIFT_PARAM_COUNT) & NODE_MASK_PARAM_COUNT;
      meta |= (methodCount << NODE_SHIFT_METHOD_COUNT) & NODE_MASK_METHOD_COUNT;

      nodeBuffer[base + NODE_OFFSET_META] = meta;

      // Methods
      let methodMask = 0;
      if (methodCount > 0) {
        const sortedEntries: { code: number; key: number }[] = [];
        for (const [mCode, key] of node.methods.byMethod.entries()) {
          const mCodeNum = Number(mCode);
          if (mCodeNum < 31) {
            methodMask |= 1 << mCodeNum;
          }
          sortedEntries.push({ code: mCodeNum, key });
        }
        sortedEntries.sort((a, b) => a.code - b.code);

        nodeBuffer[base + NODE_OFFSET_METHODS_PTR] = methodsList.length;
        for (const entry of sortedEntries) {
          methodsList.push(entry.code);
          methodsList.push(entry.key);
        }
      } else {
        nodeBuffer[base + NODE_OFFSET_METHODS_PTR] = 0;
      }
      nodeBuffer[base + NODE_OFFSET_METHOD_MASK] = methodMask;

      // Static Children
      if (node.staticChildren.size > 0) {
        nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_PTR] = staticChildrenList.length;
        nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_COUNT] = node.staticChildren.size;
        for (const [seg, child] of node.staticChildren.entries()) {
          staticChildrenList.push(getStringId(seg));
          staticChildrenList.push(nodeToIndex.get(child)!);
        }
      } else {
        nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_PTR] = 0;
        nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_COUNT] = 0;
      }

      // Param Children
      if (node.paramChildren.length > 0) {
        nodeBuffer[base + NODE_OFFSET_PARAM_CHILD_PTR] = paramChildrenList.length;
        for (const child of node.paramChildren) {
          paramChildrenList.push(nodeToIndex.get(child)!);
        }
      } else {
        nodeBuffer[base + NODE_OFFSET_PARAM_CHILD_PTR] = 0;
      }

      // Wildcard
      if (node.wildcardChild) {
        nodeBuffer[base + NODE_OFFSET_WILDCARD_CHILD_PTR] = nodeToIndex.get(node.wildcardChild)!;
      } else {
        nodeBuffer[base + NODE_OFFSET_WILDCARD_CHILD_PTR] = 0;
      }

      // Data (Name/Pattern/Segment)
      if (node.kind === NodeKind.Param) {
        const paramIdx = paramsList.length;
        paramsList.push(getStringId(node.segment));
        let patternId = 0xffffffff;
        if (node.patternSource) {
          patternId = getPatternId(node.patternSource, node.pattern?.flags ?? '');
        }
        paramsList.push(patternId);
        nodeBuffer[base + NODE_OFFSET_MATCH_FUNC] = paramIdx;
      } else {
        nodeBuffer[base + NODE_OFFSET_MATCH_FUNC] = getStringId(node.segment);
      }
    }

    return {
      nodeBuffer,
      staticChildrenBuffer: Uint32Array.from(staticChildrenList),
      paramChildrenBuffer: Uint32Array.from(paramChildrenList),
      paramsBuffer: Uint32Array.from(paramsList),
      methodsBuffer: Uint32Array.from(methodsList),
      stringTable: stringList,
      patterns,
      rootIndex: 0,
    };
  }

  private addSegments(
    node: Node,
    idx: number,
    activeParams: Set<string>,
    omittedOptionals: string[],
    method: HttpMethod,
    key: RouteKey,
    segments: string[],
  ): void {
    if (idx === segments.length) {
      if (node.methods.byMethod.has(method)) {
        const methodName = HttpMethod[method]?.toUpperCase() ?? method;
        throw new Error(`Route already exists for ${methodName} at path: /${segments.join('/')}`);
      }
      node.methods.byMethod.set(method, key);
      if (omittedOptionals.length && this.config.optionalParamDefaults) {
        this.config.optionalParamDefaults.record(key, omittedOptionals);
      }
      return;
    }

    const seg = segments[idx]!;

    // Wildcard
    if (seg.charCodeAt(0) === 42 /* '*' */) {
      if (node.staticChildren.size || node.paramChildren.length) {
        throw new Error(`Conflict: adding wildcard '*' at '${this.describeContext(segments, idx)}' would shadow existing routes`);
      }
      if (idx !== segments.length - 1) {
        throw new Error("Wildcard '*' must be the last segment");
      }
      const name = seg.length > 1 ? seg.slice(1) : '*';
      if (node.wildcardChild) {
        const existing = node.wildcardChild;
        if (existing.wildcardOrigin !== 'star' || existing.segment !== name) {
          throw new Error(`Conflict: wildcard '${existing.segment}' already exists at '${this.describeContext(segments, idx)}'`);
        }
      } else {
        this.registerGlobalParamName(name);
        node.wildcardChild = acquireNode(NodeKind.Wildcard, name);
        node.wildcardChild.wildcardOrigin = 'star';
      }

      const release = this.registerParamName(name, activeParams, segments, idx);
      try {
        this.addSegments(node.wildcardChild, idx + 1, activeParams, omittedOptionals, method, key, segments);
      } finally {
        release();
      }
      return;
    }

    // Param
    if (seg.charCodeAt(0) === 58 /* ':' */) {
      let optional = false;
      let core = seg;
      if (seg.endsWith('?')) {
        optional = true;
        core = seg.slice(0, -1);
      }
      let multi = false;
      if (core.endsWith('+')) {
        multi = true;
        core = core.slice(0, -1);
      }
      let zeroOrMore = false;
      if (core.endsWith('*')) {
        zeroOrMore = true;
        core = core.slice(0, -1);
      }

      const brace = core.indexOf('{');
      let name = '';
      let patternSrc: string | undefined;

      if (brace === -1) {
        name = core.slice(1);
      } else {
        name = core.slice(1, brace);
        if (!core.endsWith('}')) {
          throw new Error("Parameter regex must close with '}'");
        }
        patternSrc = core.slice(brace + 1, -1) || undefined;
      }

      if (!name) {
        throw new Error("Parameter segment must have a name, eg ':id'");
      }

      // Check Conflicts
      if (zeroOrMore && optional) {
        throw new Error(`Parameter ':${name}*' already allows empty matches; do not combine '*' and '?' suffixes`);
      }

      if (optional) {
        const nextOmitted = omittedOptionals.length ? [...omittedOptionals, name] : [name];
        this.addSegments(node, idx + 1, activeParams, nextOmitted, method, key, segments);
      }

      const registerScope = () => this.registerParamName(name, activeParams, segments, idx);

      if (zeroOrMore) {
        if (idx !== segments.length - 1) {
          throw new Error("Zero-or-more param ':name*' must be the last segment");
        }
        if (!node.wildcardChild) {
          this.registerGlobalParamName(name);
          node.wildcardChild = acquireNode(NodeKind.Wildcard, name || '*');
          node.wildcardChild.wildcardOrigin = 'zero';
        } else if (node.wildcardChild.wildcardOrigin !== 'zero' || node.wildcardChild.segment !== name) {
          throw new Error(
            `Conflict: zero-or-more parameter ':${name}+' cannot reuse wildcard '${node.wildcardChild.segment}' at '${this.describeContext(segments, idx)}'`,
          );
        }

        const release = registerScope();
        try {
          this.addSegments(node.wildcardChild, idx + 1, activeParams, omittedOptionals, method, key, segments);
        } finally {
          release();
        }
        return;
      }

      if (multi) {
        if (idx !== segments.length - 1) {
          throw new Error("Multi-segment param ':name+' must be the last segment");
        }
        if (!node.wildcardChild) {
          this.registerGlobalParamName(name);
          node.wildcardChild = acquireNode(NodeKind.Wildcard, name || '*');
          node.wildcardChild.wildcardOrigin = 'multi';
        } else if (node.wildcardChild.wildcardOrigin !== 'multi' || node.wildcardChild.segment !== name) {
          throw new Error(
            `Conflict: multi-parameter ':${name}+' cannot reuse wildcard '${node.wildcardChild.segment}' at '${this.describeContext(segments, idx)}'`,
          );
        }
        const release = registerScope();
        try {
          this.addSegments(node.wildcardChild, idx + 1, activeParams, omittedOptionals, method, key, segments);
        } finally {
          release();
        }
        return;
      }

      const release = registerScope();
      let child: Node | undefined;
      for (const c of node.paramChildren) {
        if (c.segment === name && (c.pattern?.source ?? undefined) === (patternSrc ?? undefined)) {
          child = c;
          break;
        }
      }

      if (!child) {
        const dup = node.paramChildren.find(c => c.segment === name && (c.pattern?.source ?? '') !== (patternSrc ?? ''));
        if (dup) {
          throw new Error(
            `Conflict: parameter ':${name}' with different regex already exists at '${this.describeContext(segments, idx)}'`,
          );
        }
        if (node.wildcardChild) {
          throw new Error(
            `Conflict: adding parameter ':${name}' under existing wildcard at '${this.describeContext(segments, idx)}'`,
          );
        }

        this.registerGlobalParamName(name);
        child = acquireNode(NodeKind.Param, name);
        if (patternSrc) {
          const normalizedPattern = this.normalizeParamPatternSource(patternSrc);
          this.ensureRegexSafe(normalizedPattern);
          const patternFlags = '';
          const compiledPattern = this.acquireCompiledPattern(normalizedPattern, patternFlags);
          child.pattern = compiledPattern;
          child.patternSource = normalizedPattern;
        }
        node.paramChildren.push(child);
        this.sortParamChildren(node);
      }

      try {
        this.addSegments(child, idx + 1, activeParams, omittedOptionals, method, key, segments);
      } finally {
        release();
      }
      return;
    }

    // Static
    let child = node.staticChildren.get(seg);
    if (!child && node.wildcardChild) {
      throw new Error(
        `Conflict: adding static segment '${seg}' under existing wildcard at '${this.describeContext(segments, idx)}'`,
      );
    }

    if (child) {
      const parts = child.segmentParts;
      if (parts && parts.length > 1) {
        const matched = this.matchStaticParts(parts, segments, idx);
        if (matched < parts.length) {
          this.splitStaticChain(child, matched);
        }
        if (matched > 1) {
          this.addSegments(child, idx + matched, activeParams, omittedOptionals, method, key, segments);
          return;
        }
      }
      this.addSegments(child, idx + 1, activeParams, omittedOptionals, method, key, segments);
      return;
    }

    child = acquireNode(NodeKind.Static, seg);
    node.staticChildren.set(seg, child);
    this.addSegments(child, idx + 1, activeParams, omittedOptionals, method, key, segments);
  }

  // --- Utils ---

  private describeContext(segments: string[], idx: number): string {
    const p = segments.slice(0, idx).join('/');
    return p ? p : idx === 0 && segments.length > 0 ? '' : 'root';
  }

  private sortParamChildren(node: Node): void {
    if (node.paramChildren.length < 2) {
      return;
    }
    node.paramChildren.sort((a, b) => {
      const weight = (child: Node) => (child.pattern ? 0 : 1);
      const diff = weight(a) - weight(b);
      if (diff !== 0) {
        return diff;
      }
      if (a.pattern && b.pattern) {
        const aLen = a.patternSource?.length ?? 0;
        const bLen = b.patternSource?.length ?? 0;
        // Longer patterns first (more specific)
        if (aLen !== bLen) {
          return bLen - aLen;
        }
      }
      return a.segment.localeCompare(b.segment);
    });
  }

  private registerParamName(name: string, activeParams: Set<string>, segments: string[], _idx: number): () => void {
    if (activeParams.has(name)) {
      throw new Error(`Duplicate parameter name ':${name}' detected in path: /${segments.join('/')}`);
    }
    activeParams.add(name);
    return () => activeParams.delete(name);
  }

  private registerGlobalParamName(name: string): void {
    if (this.config.strictParamNames && this.globalParamNames.has(name)) {
      throw new Error(`Parameter ':${name}' already registered (strict uniqueness enabled)`);
    }
    this.globalParamNames.add(name);
  }

  private ensureRegexSafe(patternSrc: string): void {
    const safety = this.config.regexSafety;
    if (!safety) {
      return;
    }

    const result = assessRegexSafety(patternSrc, {
      maxLength: safety.maxLength ?? 250,
      forbidBacktrackingTokens: safety.forbidBacktrackingTokens ?? true,
      forbidBackreferences: safety.forbidBackreferences ?? true,
    });

    if (!result.safe) {
      const msg = `Unsafe route regex '${patternSrc}' (${result.reason})`;
      if (safety.mode === 'warn') {
        console.warn(msg);
      } else {
        throw new Error(msg);
      }
    }
    safety.validator?.(patternSrc);
  }

  private normalizeParamPatternSource(patternSrc: string): string {
    let normalized = patternSrc.trim();
    if (!normalized) {
      return normalized;
    }

    let removed = false;
    if (START_ANCHOR_PATTERN.test(normalized)) {
      removed = true;
      normalized = normalized.replace(START_ANCHOR_PATTERN, '');
    }
    if (END_ANCHOR_PATTERN.test(normalized)) {
      removed = true;
      normalized = normalized.replace(END_ANCHOR_PATTERN, '');
    }
    if (!normalized) {
      normalized = '.*';
      removed = true;
    }
    if (removed) {
      // Log warning if policy
      const policy = this.config.regexAnchorPolicy;
      const msg = `[Router] Parameter regex '${patternSrc}' contained anchors which were stripped.`;
      if (policy === 'error') {
        throw new Error(msg);
      }
      if (policy === 'warn') {
        console.warn(msg);
      }
    }
    return normalized;
  }

  private acquireCompiledPattern(source: string, flags: string): RegExp {
    const key = `${flags}|${source}`;
    const cached = this.compiledPatternCache.get(key);
    if (cached) {
      return cached;
    }
    const compiled = new RegExp(`^(?:${source})$`, flags);
    this.compiledPatternCache.set(key, compiled);
    return compiled;
  }

  // --- Tree Utils (Inlined) ---

  private matchStaticParts(parts: readonly string[], segments: readonly string[], startIdx: number): number {
    let matched = 0;
    const limit = Math.min(parts.length, segments.length - startIdx);
    while (matched < limit && segments[startIdx + matched] === parts[matched]) {
      matched++;
    }
    return matched;
  }

  private splitStaticChain(node: Node, splitIndex: number): void {
    const parts = node.segmentParts;
    if (!parts || splitIndex <= 0 || splitIndex >= parts.length) {
      return;
    }
    const prefixParts = parts.slice(0, splitIndex);
    const suffixParts = parts.slice(splitIndex);
    const suffixNode = acquireNode(NodeKind.Static, suffixParts.length > 1 ? suffixParts.join('/') : suffixParts[0]!);
    if (suffixParts.length > 1) {
      suffixNode.segmentParts = [...suffixParts];
    }
    suffixNode.staticChildren = node.staticChildren;
    suffixNode.paramChildren = node.paramChildren;
    suffixNode.wildcardChild = node.wildcardChild;
    suffixNode.methods = node.methods;

    node.staticChildren = StaticChildStore.fromEntries([[suffixParts[0]!, suffixNode]]);
    node.paramChildren = [];
    node.wildcardChild = undefined;
    node.methods = { byMethod: new Map() };
    node.segment = prefixParts.length > 1 ? prefixParts.join('/') : prefixParts[0]!;
    node.segmentParts = prefixParts.length > 1 ? prefixParts : undefined;
  }
}

// ----------------------------------------------------------------------
// Regex Safety Helpers (Restored)
// ----------------------------------------------------------------------

type QuantifierFrame = {
  hadUnlimited: boolean;
};

function hasNestedUnlimitedQuantifiers(pattern: string): boolean {
  const stack: QuantifierFrame[] = [];
  let lastAtomUnlimited = false;
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i]!;
    if (char === '\\') {
      i++;
      lastAtomUnlimited = false;
      continue;
    }
    if (char === '[') {
      i = skipCharClass(pattern, i);
      lastAtomUnlimited = false;
      continue;
    }
    if (char === '(') {
      stack.push({ hadUnlimited: false });
      lastAtomUnlimited = false;
      continue;
    }
    if (char === ')') {
      const frame = stack.pop();
      const groupUnlimited = Boolean(frame?.hadUnlimited);
      if (groupUnlimited && stack.length) {
        stack[stack.length - 1]!.hadUnlimited = true;
      }
      lastAtomUnlimited = groupUnlimited;
      continue;
    }
    if (char === '*' || char === '+') {
      if (lastAtomUnlimited) {
        return true;
      }
      lastAtomUnlimited = true;
      if (stack.length) {
        stack[stack.length - 1]!.hadUnlimited = true;
      }
      continue;
    }
    if (char === '{') {
      const close = pattern.indexOf('}', i + 1);
      if (close === -1) {
        lastAtomUnlimited = false;
        continue;
      }
      const slice = pattern.slice(i + 1, close);
      const unlimited = slice.includes(',');
      if (unlimited) {
        if (lastAtomUnlimited) {
          return true;
        }
        lastAtomUnlimited = true;
        if (stack.length) {
          stack[stack.length - 1]!.hadUnlimited = true;
        }
      } else {
        lastAtomUnlimited = false;
      }
      i = close;
      continue;
    }
    lastAtomUnlimited = false;
  }
  return false;
}

function skipCharClass(pattern: string, start: number): number {
  let i = start + 1;
  while (i < pattern.length) {
    const char = pattern[i]!;
    if (char === '\\') {
      i += 2;
      continue;
    }
    if (char === ']') {
      return i;
    }
    i++;
  }
  return pattern.length - 1;
}

function assessRegexSafety(
  pattern: string,
  options: { maxLength: number; forbidBacktrackingTokens: boolean; forbidBackreferences: boolean },
): { safe: boolean; reason?: string } {
  if (pattern.length > options.maxLength) {
    return { safe: false, reason: `Regex length ${pattern.length} exceeds limit ${options.maxLength}` };
  }
  if (options.forbidBackreferences && BACKREFERENCE_PATTERN.test(pattern)) {
    return { safe: false, reason: 'Backreferences are not allowed in route params' };
  }

  if (options.forbidBacktrackingTokens && hasNestedUnlimitedQuantifiers(pattern)) {
    return { safe: false, reason: 'Nested unlimited quantifiers detected' };
  }
  return { safe: true };
}

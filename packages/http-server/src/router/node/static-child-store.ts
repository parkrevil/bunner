import type { RouterNode } from './router-node';

const INLINE_THRESHOLD = 4;

type Entry = [string, RouterNode];

interface SortedChildArrays {
  segments: string[];
  nodes: RouterNode[];
  fingerprints: number[];
}

/**
 * StaticChildStore keeps per-node static children compact by staying in an inline array mode for
 * tiny fan-outs and promoting to sorted/fingerprinted arrays once the threshold is crossed. This
 * avoids Map churn and lets callers perform cache-friendly binary searches during layout walks.
 */
export class StaticChildStore implements Iterable<Entry> {
  private inlineKeys: string[] | null = null;
  private inlineValues: RouterNode[] | null = null;
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

  get(segment: string): RouterNode | undefined {
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

  set(segment: string, node: RouterNode): this {
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

  values(): IterableIterator<RouterNode> {
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

  private promote(): void {
    if (this.sorted || !this.inlineKeys || !this.inlineValues) {
      return;
    }
    const entries: Array<{ segment: string; node: RouterNode; fingerprint: number }> = new Array(this.inlineCount);
    for (let i = 0; i < this.inlineCount; i++) {
      const segment = this.inlineKeys[i]!;
      entries[i] = { segment, node: this.inlineValues[i]!, fingerprint: fingerprintSegment(segment) };
    }
    entries.sort((a, b) => compareEntries(a, b));
    const segments = new Array<string>(entries.length);
    const nodes = new Array<RouterNode>(entries.length);
    const fingerprints = new Array<number>(entries.length);
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      segments[i] = entry.segment;
      nodes[i] = entry.node;
      fingerprints[i] = entry.fingerprint;
    }
    this.sorted = { segments, nodes, fingerprints };
    this.inlineKeys = null;
    this.inlineValues = null;
  }

  private setInSorted(segment: string, node: RouterNode): void {
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

  private getFromSorted(segment: string): RouterNode | undefined {
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

  private *iterateInlineValues(): IterableIterator<RouterNode> {
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

  private *iterateSortedValues(): IterableIterator<RouterNode> {
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

function compareEntries(a: { segment: string; fingerprint: number }, b: { segment: string; fingerprint: number }): number {
  return compareFingerprintAndSegment(a.fingerprint, a.segment, b.fingerprint, b.segment);
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

type CacheIndexNode = {
  keys?: Set<string>;
  children: Map<string, CacheIndexNode>;
};

const createNode = (): CacheIndexNode => ({ children: new Map() });

const splitPathKey = (key: string): string[] => {
  if (!key || key === '/') {
    return [];
  }
  return key.split('/');
};

export class CacheIndex {
  private root: CacheIndexNode = createNode();

  add(path: string, cacheKey: string): void {
    const node = this.traverse(path, true)!;
    if (!node.keys) {
      node.keys = new Set();
    }
    node.keys.add(cacheKey);
  }

  collectExact(path: string, methodPrefix: string, acc: string[]): void {
    const node = this.traverse(path, false);
    if (!node || !node.keys) {
      return;
    }
    for (const key of node.keys) {
      if (key.startsWith(methodPrefix)) {
        acc.push(key);
      }
    }
  }

  collectPrefix(path: string, methodPrefix: string, acc: string[]): void {
    const node = this.traverse(path, false);
    if (!node) {
      return;
    }
    this.collectFromNode(node, methodPrefix, acc);
  }

  remove(path: string, cacheKey: string): void {
    this.removeRecursive(this.root, splitPathKey(path), 0, cacheKey);
  }

  clear(): void {
    this.root = createNode();
  }

  private traverse(path: string, create: boolean): CacheIndexNode | undefined {
    const segments = splitPathKey(path);
    let node = this.root;
    for (const segment of segments) {
      let child = node.children.get(segment);
      if (!child) {
        if (!create) {
          return undefined;
        }
        child = createNode();
        node.children.set(segment, child);
      }
      node = child;
    }
    return node;
  }

  private collectFromNode(node: CacheIndexNode, methodPrefix: string, acc: string[]): void {
    if (node.keys) {
      for (const key of node.keys) {
        if (key.startsWith(methodPrefix)) {
          acc.push(key);
        }
      }
    }
    for (const [, child] of node.children) {
      this.collectFromNode(child, methodPrefix, acc);
    }
  }

  private removeRecursive(node: CacheIndexNode, segments: string[], idx: number, cacheKey: string): boolean {
    if (idx === segments.length) {
      node.keys?.delete(cacheKey);
    } else {
      const segment = segments[idx]!;
      const child = node.children.get(segment);
      if (child) {
        const shouldRemove = this.removeRecursive(child, segments, idx + 1, cacheKey);
        if (shouldRemove) {
          node.children.delete(segment);
        }
      }
    }
    if (node.keys && node.keys.size === 0) {
      node.keys = undefined;
    }
    const noKeys = !node.keys;
    return noKeys && node.children.size === 0;
  }
}

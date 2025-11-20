import { NodeKind } from '../enums';

import { RouterNode } from './router-node';

const MAX_POOL_SIZE = 16_384;

class RouterNodePool {
  private readonly stack: RouterNode[] = [];

  acquire(kind: NodeKind, segment: string): RouterNode {
    const node = this.stack.pop();
    if (node) {
      node.resetState(kind, segment);
      return node;
    }
    return new RouterNode(kind, segment);
  }

  release(node: RouterNode): void {
    if (this.stack.length >= MAX_POOL_SIZE) {
      return;
    }
    node.resetState(NodeKind.Static, '');
    this.stack.push(node);
  }
}

const NODE_POOL = new RouterNodePool();

export const acquireRouterNode = (kind: NodeKind, segment: string): RouterNode => NODE_POOL.acquire(kind, segment);

export const releaseRouterNode = (node: RouterNode): void => {
  NODE_POOL.release(node);
};

export const releaseRouterSubtree = (node: RouterNode): void => {
  for (const child of node.staticChildren.values()) {
    releaseRouterSubtree(child);
  }
  for (const child of node.paramChildren) {
    releaseRouterSubtree(child);
  }
  if (node.wildcardChild) {
    releaseRouterSubtree(node.wildcardChild);
  }
  releaseRouterNode(node);
};

import { NodeKind } from './enums';
import { RouterNode } from './node';

export function matchStaticParts(parts: string[], segments: string[], startIdx: number): number {
  let matched = 0;
  const limit = Math.min(parts.length, segments.length - startIdx);
  while (matched < limit && segments[startIdx + matched] === parts[matched]) {
    matched++;
  }
  return matched;
}

export function splitStaticChain(node: RouterNode, splitIndex: number): void {
  const parts = node.segmentParts;
  if (!parts || splitIndex <= 0 || splitIndex >= parts.length) {
    return;
  }
  const prefixParts = parts.slice(0, splitIndex);
  const suffixParts = parts.slice(splitIndex);
  const suffixNode = new RouterNode(NodeKind.Static, suffixParts.length > 1 ? suffixParts.join('/') : suffixParts[0]!);
  if (suffixParts.length > 1) {
    suffixNode.segmentParts = [...suffixParts];
  }
  suffixNode.staticChildren = node.staticChildren;
  suffixNode.paramChildren = node.paramChildren;
  suffixNode.wildcardChild = node.wildcardChild;
  suffixNode.methods = node.methods;

  node.staticChildren = new Map([[suffixParts[0]!, suffixNode]]);
  node.paramChildren = [];
  node.wildcardChild = undefined;
  node.methods = { byMethod: new Map() };
  node.segment = prefixParts.length > 1 ? prefixParts.join('/') : prefixParts[0]!;
  node.segmentParts = prefixParts.length > 1 ? prefixParts : undefined;
}

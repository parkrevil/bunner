import { NodeKind } from '../enums';
import type { RouterNode } from '../node/router-node';

import {
  type BinaryRouterLayout,
  NODE_STRIDE,
  NODE_OFFSET_META,
  NODE_OFFSET_METHOD_MASK,
  NODE_OFFSET_MATCH_FUNC,
  NODE_OFFSET_STATIC_CHILD_PTR,
  NODE_OFFSET_STATIC_CHILD_COUNT,
  NODE_OFFSET_PARAM_CHILD_PTR,
  NODE_OFFSET_WILDCARD_CHILD_PTR,
  NODE_OFFSET_METHODS_PTR,
  NODE_MASK_KIND,
  NODE_MASK_WILDCARD_ORIGIN,
  NODE_SHIFT_WILDCARD_ORIGIN,
  NODE_MASK_PARAM_COUNT,
  NODE_SHIFT_PARAM_COUNT,
  NODE_MASK_METHOD_COUNT,
  NODE_SHIFT_METHOD_COUNT,
} from './binary-router-layout';
import type { SerializedPattern } from './immutable-router-layout';

// Method Map removed - keys are already numbers

export function compileToBinary(root: RouterNode): BinaryRouterLayout {
  // 1. Linearize Nodes (DFS Pre-order so root is 0 and children are somewhat local)
  // Actually BFS is often better for locality of siblings which are iterated together?
  // But BFS puts children far away.
  // In `node.staticChildren`, we iterate pointers. The check is `string === segment`.
  // We jump to child.
  // So locality of *Child Node* to *Parent* matters less than locality of *Child Node's Data*?
  // No, locality of child node matters when we jump to it.
  // But siblings are not iterated in the node buffer; they are iterated in the `staticChildrenBuffer`.
  // `staticChildrenBuffer` has `[SegID, ChildPtr, SegID, ChildPtr]`.
  // So `staticChildrenBuffer` should be linear.
  // The nodes themselves can be anywhere.
  // Let's use BFS for stable ordering.

  const nodes: RouterNode[] = [];
  const nodeToIndex = new Map<RouterNode, number>();

  const queue: RouterNode[] = [root];

  while (queue.length) {
    const node = queue.shift()!;
    if (nodeToIndex.has(node)) {
      continue;
    }

    nodeToIndex.set(node, nodes.length);
    nodes.push(node);

    // Enqueue children
    // Static
    if (node.staticChildren.size) {
      for (const child of node.staticChildren.values()) {
        queue.push(child);
      }
    }
    // Param
    for (const child of node.paramChildren) {
      queue.push(child);
    }
    // Wildcard
    if (node.wildcardChild) {
      queue.push(node.wildcardChild);
    }
  }

  // Buffers
  const nodeBuffer = new Uint32Array(nodes.length * NODE_STRIDE);

  // Intermediate arrays
  const staticChildrenList: number[] = [];
  const paramChildrenList: number[] = [];
  const paramsList: number[] = [];
  const methodsList: number[] = [0]; // Dummy 0 so valid pointers are > 0

  const stringList: string[] = [];
  const stringMap = new Map<string, number>();

  const patterns: SerializedPattern[] = [];
  const patternMap = new Map<string, number>();

  function getStringId(str: string): number {
    let id = stringMap.get(str);
    if (id === undefined) {
      id = stringList.length;
      stringList.push(str);
      stringMap.set(str, id);
    }
    return id;
  }

  function getPatternId(source: string, flags: string): number {
    const key = `${flags}|${source}`;
    let id = patternMap.get(key);
    if (id === undefined) {
      id = patterns.length;
      patterns.push({ source, flags });
      patternMap.set(key, id);
    }
    return id;
  }

  // 2. Build Nodes
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

    // Method Mask & Methods Ptr
    let methodMask = 0;
    if (methodCount > 0) {
      const methodKeys: number[] = [];
      // Extract keys
      for (const mCode of node.methods.byMethod.keys()) {
        if ((mCode as number) < 31) {
          methodMask |= 1 << (mCode as number);
        }
        methodKeys.push(mCode as number);
      }
      // Store methods pointer
      nodeBuffer[base + NODE_OFFSET_METHODS_PTR] = methodsList.length;

      // Write methods (Count, MethodID, RouteKey, MethodID, RouteKey...)
      // To save space, we just write pairs. Count is in Meta (if < 255).
      // Sort for consistent binary output
      // We need to map mCode back to original key to get handler? No, keys() gives original key.
      // We need to associate mCode with value.

      const sortedEntries: { code: number; key: number }[] = [];
      for (const [mCode, key] of node.methods.byMethod.entries()) {
        sortedEntries.push({ code: mCode as number, key: key });
      }
      sortedEntries.sort((a, b) => a.code - b.code);

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
      // Check count overflow? Max 32-bit count is fine.
      nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_COUNT] = node.staticChildren.size;

      // Write Static Children pairs: [SegID, ChildPtr]
      for (const [seg, child] of node.staticChildren.entries()) {
        const childIdx = nodeToIndex.get(child)!;
        staticChildrenList.push(getStringId(seg));
        staticChildrenList.push(childIdx);
      }
    } else {
      nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_PTR] = 0;
      nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_COUNT] = 0;
    }

    // Param Children
    if (node.paramChildren.length > 0) {
      nodeBuffer[base + NODE_OFFSET_PARAM_CHILD_PTR] = paramChildrenList.length;
      // Count is in Meta.

      for (const child of node.paramChildren) {
        paramChildrenList.push(nodeToIndex.get(child)!);
      }
    } else {
      nodeBuffer[base + NODE_OFFSET_PARAM_CHILD_PTR] = 0;
    }

    // Wildcard Child
    if (node.wildcardChild) {
      const childIdx = nodeToIndex.get(node.wildcardChild)!;
      nodeBuffer[base + NODE_OFFSET_WILDCARD_CHILD_PTR] = childIdx;
    } else {
      nodeBuffer[base + NODE_OFFSET_WILDCARD_CHILD_PTR] = 0; // 0 usually root, but if root is Wildcard Child?
      // 0 is root. Valid child index can be 0 only if root is child (impossible).
      // So 0 serves as null.
    }

    // Slot 2: MATCH_FUNC / DATA
    // Param Node: Index into ParamsBuffer
    // Static Node: StringID of segment (redundant if parent checks it, but good for debugging or double check?)
    // Actually, Static Node doesn't need to know its own segment usually, the parent check handles it.
    // BUT, root or debugging might need it.
    // And Matcher needs it? No, Parent's Static Children Table maps Segment -> Child.
    // Once we jump to Child, we are "at" that segment.

    // However, Param Node needs Name and Pattern.
    // And Param Names are properties of the Child Node (the Param Node).

    if (node.kind === NodeKind.Param) {
      const paramIdx = paramsList.length;
      // Format: [NameID, PatternID]
      // Push Name
      paramsList.push(getStringId(node.segment)); // segment is param name
      // Push Pattern
      let patternId = 0xffffffff; // -1
      if (node.patternSource) {
        // Need source and flags
        const source = node.patternSource;
        // node.pattern is RegExp, flags?
        // RouterNode doesn't store flags explicitly usually, but `pattern.flags`.
        // node.pattern is optional.
        // If pattern is set, use it.
        const flags = node.pattern?.flags ?? '';
        patternId = getPatternId(source, flags);
      }
      paramsList.push(patternId);

      // Store index into paramsBuffer
      nodeBuffer[base + NODE_OFFSET_MATCH_FUNC] = paramIdx;
    } else if (node.kind === NodeKind.Wildcard) {
      // Wildcard also has a name (segment).
      // Reuse ParamsBuffer? Or just StringID?
      // Wildcard doesn't support Regex usually (RouterNode has pattern?).
      // Router supports Wildcard regex logic? Usually no, just "*".
      // But `wildcardOrigin` might imply behavior.
      // Let's store Name StringID in Slot 2 directly.
      nodeBuffer[base + NODE_OFFSET_MATCH_FUNC] = getStringId(node.segment);
    } else {
      // Static
      // Store Segment StringID in Slot 2 (Optionally)
      nodeBuffer[base + NODE_OFFSET_MATCH_FUNC] = getStringId(node.segment);
    }
  }

  return {
    nodeBuffer,
    staticChildrenBuffer: Uint32Array.from(staticChildrenList),
    paramChildrenBuffer: Uint32Array.from(paramChildrenList),
    paramsBuffer: Uint32Array.from(paramsList),
    methodsBuffer: Uint32Array.from(methodsList),
    stringTable: stringList, // string[]
    patterns, // SerializedPattern[]
    rootIndex: 0, // Root is always 0 in linear array if pushed first
  };
}

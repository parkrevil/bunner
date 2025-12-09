import { HttpMethod } from '../enums';

export { HttpMethod };

export enum NodeKind {
  Static = 'static',
  Param = 'param',
  Wildcard = 'wildcard',
}

// Node Layout Constants (Offsets in Uint32)
export const NODE_STRIDE = 8;

export const NODE_OFFSET_META = 0;
// META: [Kind (8bit) | MethodCount (8bit) | WildcardOrigin (8bit) | Flags (8bit)]
export const NODE_OFFSET_METHOD_MASK = 1;
export const NODE_OFFSET_MATCH_FUNC = 2; // Reserved for fast-match function ID or Pattern ID
export const NODE_OFFSET_STATIC_CHILD_PTR = 3;
export const NODE_OFFSET_STATIC_CHILD_COUNT = 4;
export const NODE_OFFSET_PARAM_CHILD_PTR = 5;
export const NODE_OFFSET_WILDCARD_CHILD_PTR = 6;
export const NODE_OFFSET_METHODS_PTR = 7;

// Param Table Stride
export const PARAM_ENTRY_STRIDE = 2;
export const PARAM_OFFSET_NAME = 0;
export const PARAM_OFFSET_PATTERN = 1;

export const NODE_MASK_KIND = 0xff;
export const NODE_MASK_WILDCARD_ORIGIN = 0xff00;
export const NODE_SHIFT_WILDCARD_ORIGIN = 8;
export const NODE_MASK_PARAM_COUNT = 0xff0000;
export const NODE_SHIFT_PARAM_COUNT = 16;
export const NODE_MASK_METHOD_COUNT = 0xff000000;
export const NODE_SHIFT_METHOD_COUNT = 24;

export interface SerializedPattern {
  source: string;
  flags: string;
}

export interface BinaryRouterLayout {
  /**
   * The main node arena.
   * Each node occupies NODE_STRIDE (8) words.
   */
  readonly nodeBuffer: Uint32Array;

  /**
   * Static Children Table.
   * Format: [SegmentStringIndex, TargetNodeIndex, ...]
   */
  readonly staticChildrenBuffer: Uint32Array;

  /**
   * Param Children Table.
   * Format: [TargetNodeIndex, ...]
   */
  readonly paramChildrenBuffer: Uint32Array;

  /**
   * Params Table (for Param Nodes).
   * Format: [NameStringIndex, PatternIndex, ...]
   * PatternIndex is -1 (or 0xFFFFFFFF) if no pattern.
   */
  readonly paramsBuffer: Uint32Array;

  /**
   * Methods Handler Table.
   * Format: [MethodEnum, RouteKey, ...]
   */
  readonly methodsBuffer: Uint32Array;

  /**
   * String table for segment values and param names.
   * Indexed by integer IDs stored in buffers.
   */
  readonly stringTable: ReadonlyArray<string>;

  /**
   * Regex patterns.
   */
  readonly patterns: ReadonlyArray<SerializedPattern>;

  /**
   * Root node index in nodeBuffer (usually 0).
   */
  readonly rootIndex: number;
}

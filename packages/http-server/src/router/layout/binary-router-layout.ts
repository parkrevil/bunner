import type { SerializedPattern } from './immutable-router-layout';

/**
 * BinaryRouterLayout uses TypedArrays to store the router structure.
 * This maximizes cache locality and eliminates GC overhead for the router graph.
 */
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

// Node Layout Constants (Offsets in Uint32)
export const NODE_STRIDE = 8;

export const NODE_OFFSET_META = 0;
// META: [Kind (8bit) | MethodCount (8bit) | WildcardOrigin (8bit) | Flags (8bit)]
export const NODE_OFFSET_METHOD_MASK = 1;
export const NODE_OFFSET_MATCH_FUNC = 2; // Reserved for fast-match function ID or Pattern ID
export const NODE_OFFSET_STATIC_CHILD_PTR = 3;
export const NODE_OFFSET_STATIC_CHILD_COUNT = 4; // Need count! Plan missed this? Or implicit range?
// Plan said: "Static Range Start/Count"?
// Let's use Ptr + Count.
// Plan said: "Static Range Start" in previous Immutable Layout.
// Here: Ptr is index into staticChildrenBuffer.
export const NODE_OFFSET_PARAM_CHILD_PTR = 5;
export const NODE_OFFSET_PARAM_CHILD_COUNT = 6; // Need count.
// Wait, I have 8 slots.
// 0: META
// 1: METHOD_MASK
// 2: MATCH_FUNC / PATTERN_ID
// 3: STATIC_PTR
// 4: STATIC_COUNT
// 5: PARAM_PTR
// 6: WILDCARD_CHILD_PTR (Single child, -1 if none)
// 7: METHODS_PTR (Count is in META?)

// Let's refine the slots.
// Field 0: META (Kind, MethodCount, WildcardOrigin, ParamCount?)
// Param count is usually small?
// Static count is usually small?
// Let's pack counts in META?
// Kind (3 bit), WildcardOrigin (2 bit)...
// Uint32 = 32 bits.
// Kind: 4 bits
// MethodCount: 5 bits (0-31)
// WildcardOrigin: 2 bits
// ParamCount: 4 bits? (Usually 1, but maybe more)
// StaticCount: can be large.

// Alternative: Store range start/end or ptr/count.
// Slot 3: STATIC_PTR
// Slot 4: STATIC_COUNT
// Slot 5: PARAM_PTR
// Slot 6: PARAM_COUNT (Most nodes have 0 or 1 param, but conflicts exist)
// Slot 7: WILDCARD_CHILD_PTR
// Slot 8? No, Stride 8.

// We need Methods Ptr.
// Slot 1 is METHOD_MASK (Bitmap).
// If we have methods, where is the list?
// We need METHODS_PTR.

// Revised Layout (Stride 8):
// 0: META [Kind(8) | WildcardOrigin(8) | ParamCount(8) | MethodCount(8)]
// 1: METHOD_MASK
// 2: PATTERN_IDX (for params) or SEGMENT_IDX (for static/check?) - Static uses fast map.
//    Actually for Param Node, we need param name index.
//    For Static Node, we need segment string index? No, parent points to us with segment.
// 3: STATIC_CHILD_PTR
// 4: STATIC_CHILD_COUNT
// 5: PARAM_CHILD_PTR
// 6: WILDCARD_CHILD_PTR
// 7: METHODS_PTR

// This fits exactly 8 words (32 bytes).
// Method count is in META.
// Param count is in META.

// Param Table Stride
export const PARAM_ENTRY_STRIDE = 2;
export const PARAM_OFFSET_NAME = 0;
export const PARAM_OFFSET_PATTERN = 1;

export const NODE_OFFSET_WILDCARD_CHILD_PTR = 6;
export const NODE_OFFSET_METHODS_PTR = 7;

export const NODE_MASK_KIND = 0xff;
export const NODE_MASK_WILDCARD_ORIGIN = 0xff00;
export const NODE_SHIFT_WILDCARD_ORIGIN = 8;
export const NODE_MASK_PARAM_COUNT = 0xff0000;
export const NODE_SHIFT_PARAM_COUNT = 16;
export const NODE_MASK_METHOD_COUNT = 0xff000000;
export const NODE_SHIFT_METHOD_COUNT = 24;

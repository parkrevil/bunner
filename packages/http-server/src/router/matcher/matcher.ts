import type { HttpMethod } from '../../types';
import { decodeURIComponentSafe } from '../processor';
import type { BinaryRouterLayout } from '../schema';
import {
  NODE_OFFSET_META,
  NODE_OFFSET_METHOD_MASK,
  NODE_OFFSET_MATCH_FUNC,
  NODE_OFFSET_STATIC_CHILD_PTR,
  NODE_OFFSET_STATIC_CHILD_COUNT,
  NODE_OFFSET_PARAM_CHILD_PTR,
  NODE_OFFSET_WILDCARD_CHILD_PTR,
  NODE_OFFSET_METHODS_PTR,
  NODE_MASK_METHOD_COUNT,
  NODE_SHIFT_METHOD_COUNT,
  NODE_MASK_PARAM_COUNT,
  NODE_SHIFT_PARAM_COUNT,
  NODE_MASK_WILDCARD_ORIGIN,
  NODE_SHIFT_WILDCARD_ORIGIN,
  NODE_STRIDE,
  PARAM_ENTRY_STRIDE,
  METHOD_OFFSET,
} from '../schema';
import type { DynamicMatchResult, EncodedSlashBehavior, PatternTesterFn, RouteParams, SuffixPlan } from '../types';

import {
  STAGE_ENTER,
  STAGE_STATIC,
  STAGE_PARAM,
  STAGE_WILDCARD,
  FRAME_SIZE,
  FRAME_OFFSET_NODE,
  FRAME_OFFSET_SEGMENT,
  FRAME_OFFSET_STAGE,
  FRAME_OFFSET_PARAM_BASE,
  FRAME_OFFSET_ITERATOR,
  MAX_STACK_DEPTH,
  MAX_PARAMS,
} from './constants';

export class Matcher {
  // Layout Buffers
  private readonly nodeBuffer: Uint32Array;
  private readonly staticChildrenBuffer: Uint32Array;
  private readonly paramChildrenBuffer: Uint32Array;
  private readonly paramsBuffer: Uint32Array;
  private readonly methodsBuffer: Uint32Array;
  private readonly stringTable: Uint8Array;
  private readonly stringOffsets: Uint32Array;
  private readonly rootIndex: number;

  private readonly patternTesters: ReadonlyArray<PatternTesterFn | undefined>;
  private readonly encodedSlashBehavior: EncodedSlashBehavior;
  private readonly failFastOnBadEncoding: boolean;

  // Runtime State (Pooled/Reused)
  private readonly stack: Int32Array;
  private paramNames: string[] = new Array(MAX_PARAMS);
  private paramValues: string[] = new Array(MAX_PARAMS);
  private paramCache: string[] = new Array(MAX_STACK_DEPTH);
  private paramCount = 0;

  // Native Decoder
  private readonly decoder = new TextDecoder();
  private readonly decodedStrings: string[];

  // Current Request Context
  private methodCode: number = 0;
  private segments!: string[];
  private segmentHints: Uint8Array | undefined;

  constructor(
    layout: BinaryRouterLayout,
    globalConfig: {
      patternTesters: ReadonlyArray<PatternTesterFn | undefined>;
      encodedSlashBehavior: EncodedSlashBehavior;
      failFastOnBadEncoding: boolean;
    },
  ) {
    // Unpack Layout
    this.nodeBuffer = layout.nodeBuffer;
    this.staticChildrenBuffer = layout.staticChildrenBuffer;
    this.paramChildrenBuffer = layout.paramChildrenBuffer;
    this.paramsBuffer = layout.paramsBuffer;
    this.methodsBuffer = layout.methodsBuffer;
    this.stringTable = layout.stringTable;
    this.stringOffsets = layout.stringOffsets;
    this.rootIndex = layout.rootIndex;

    this.patternTesters = globalConfig.patternTesters;
    this.encodedSlashBehavior = globalConfig.encodedSlashBehavior;
    this.failFastOnBadEncoding = globalConfig.failFastOnBadEncoding;

    // Stack init
    this.stack = new Int32Array(MAX_STACK_DEPTH * FRAME_SIZE);

    // Init Cache (Lazy)
    
    // Init Cache (Lazy)
    // We don't know the size of stringTable items count easily without iterating, 
    // but we can just use sparse array since IDs are sequential from Flattener.
    this.decodedStrings = []; 
  }

  private getString(id: number): string {
    const cached = this.decodedStrings[id];
    if (cached !== undefined) {
      return cached;
    }
    const start = this.stringOffsets[id]!;
    const end = this.stringOffsets[id + 1]!;
    const val = this.decoder.decode(this.stringTable.subarray(start, end));
    this.decodedStrings[id] = val;
    return val;
  }

  /**
   * Executes the matching process for a given path.
   * @param method The HTTP Method code.
   * @param segments The tokenized path segments.
   * @param segmentHints Optional encoding hints for segments.
   * @param decodeParams Whether to decode URL-encoded parameters.
   * @param captureSnapshot Whether to capture a snapshot of params for debugging/observability.
   * @param suffixPlanFactory Optional factory for suffix matching strategies (optimization).
   */
  public exec(
    method: HttpMethod,
    segments: string[],
    segmentHints: Uint8Array | undefined,
    decodeParams: boolean,
    captureSnapshot: boolean,
    suffixPlanFactory?: () => SuffixPlan | undefined,
  ): DynamicMatchResult | null {
    // Reset State
    const code = METHOD_OFFSET[method];
    if (code === undefined) {
      return null; // Unknown method
    }
    this.methodCode = code;
    this.segments = segments;
    this.segmentHints = segmentHints;
    this.paramCount = 0;

    // Clear Cache
    for (let i = 0; i < segments.length; i++) {
      this.paramCache[i] = undefined as unknown as string;
    }

    const handlerIndex = this.walk(decodeParams, suffixPlanFactory);

    if (handlerIndex === null) {
      return null;
    }

    // Build Result
    const bag = Object.create(null) as RouteParams;
    let snapshot: Array<[string, string | undefined]> | undefined;
    if (captureSnapshot) {
      snapshot = new Array(this.paramCount);
    }

    for (let i = 0; i < this.paramCount; i++) {
      const name = this.paramNames[i]!;
      const value = this.paramValues[i]!;
      bag[name] = value;
      if (snapshot) {
        snapshot[i] = [name, value];
      }
    }
    return { handlerIndex, params: bag, snapshot };
  }

  private decodeAndCache(index: number, decodeParams: boolean): string | undefined {
    if (this.paramCache[index] !== undefined) {
      return this.paramCache[index];
    }

    const raw = this.segments[index];
    if (!decodeParams) {
      this.paramCache[index] = raw!;
      return raw;
    }

    const hints = this.segmentHints;
    if (!hints || hints[index] === 0) {
      this.paramCache[index] = raw!;
      return raw;
    }

    const decoded = decodeURIComponentSafe(raw!, this.encodedSlashBehavior, this.failFastOnBadEncoding);
    this.paramCache[index] = decoded;

    return decoded;
  }

  /**
   * The core Stack Machine for traversing the Radix Tree.
   * Uses a flat Int32Array stack to avoid recursion and object allocation overhead.
   *
   * States:
   * - STAGE_ENTER: Entering a node. Checks for match if path ends, otherwise transitions to STATIC or WILDCARD.
   * - STAGE_STATIC: Accessing static children table (Binary Search or Linear Scan).
   * - STAGE_PARAM: Iterating over parameter children.
   * - STAGE_WILDCARD: Checking wildcard match as last resort.
   */
  private walk(decodeParams: boolean, suffixPlanFactory?: () => SuffixPlan | undefined): number | null {
    let sp = 0;

    // Push Root Frame
    this.stack[sp + FRAME_OFFSET_NODE] = this.rootIndex;
    this.stack[sp + FRAME_OFFSET_SEGMENT] = 0;
    this.stack[sp + FRAME_OFFSET_STAGE] = STAGE_ENTER;
    this.stack[sp + FRAME_OFFSET_PARAM_BASE] = 0;
    this.stack[sp + FRAME_OFFSET_ITERATOR] = 0;

    sp += FRAME_SIZE;

    while (sp > 0) {
      const framePtr = sp - FRAME_SIZE;
      const stage = this.stack[framePtr + FRAME_OFFSET_STAGE]!;
      const nodeIdx = this.stack[framePtr + FRAME_OFFSET_NODE]!;
      const segIdx = this.stack[framePtr + FRAME_OFFSET_SEGMENT]!;

      // --- 1. ENTRY STAGE ---
      if (stage === STAGE_ENTER) {
        // Path matches fully?
        if (segIdx === this.segments.length) {
          const base = nodeIdx * NODE_STRIDE;
          const methodsPtr = this.nodeBuffer[base + NODE_OFFSET_METHODS_PTR]!;
          if (methodsPtr > 0) {
            const mask = this.nodeBuffer[base + NODE_OFFSET_METHOD_MASK]!;
            if (this.methodCode < 31 && mask & (1 << this.methodCode)) {
              const meta = this.nodeBuffer[base + NODE_OFFSET_META]!;
              const methodCount = (meta & NODE_MASK_METHOD_COUNT) >>> NODE_SHIFT_METHOD_COUNT;
              let ptr = methodsPtr;
              for (let i = 0; i < methodCount; i++) {
                if (this.methodsBuffer[ptr] === this.methodCode) {
                  return this.methodsBuffer[ptr + 1]!;
                }
                ptr += 2;
              }
            }
          }
          // Try Wildcard as fallback if method not found? No, if segments ended, wildcard only matches if it accepts empty,
          // but wildcard children are distinct from "this node".
          // Actually, if we are at end of path, we don't traverse children usually.
          // BUT if the path ends here, and we didn't find a method, we might technically fall through to something else?
          // In this implementation, if segments ended, we only look at THIS node methods.
          this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_WILDCARD; // This seems to imply we might accept empty wildcard match?
          continue;
        }
        this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_STATIC;
        continue;
      } else if (stage === STAGE_STATIC) {
        // --- 2. STATIC CHILDREN ---
        const base = nodeIdx * NODE_STRIDE;
        const stateIter = this.stack[framePtr + FRAME_OFFSET_ITERATOR]!;

        // Iterator 0: Init, 1: Done
        if (stateIter > 0) {
          this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_PARAM;
          this.stack[framePtr + FRAME_OFFSET_ITERATOR] = 0;
          continue;
        }
        this.stack[framePtr + FRAME_OFFSET_ITERATOR] = 1;

        const staticCount = this.nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_COUNT]!;
        if (staticCount > 0) {
          const staticPtr = this.nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_PTR]!;
          const segment = this.segments[segIdx]!;

          const childPtr = this.findStaticChild(staticPtr, staticCount, segment);

          if (childPtr !== -1) {
            // Push Child Frame
            this.stack[sp + FRAME_OFFSET_NODE] = childPtr;
            this.stack[sp + FRAME_OFFSET_SEGMENT] = segIdx + 1;
            this.stack[sp + FRAME_OFFSET_STAGE] = STAGE_ENTER;
            this.stack[sp + FRAME_OFFSET_PARAM_BASE] = this.paramCount;
            this.stack[sp + FRAME_OFFSET_ITERATOR] = 0;
            sp += FRAME_SIZE;
            continue;
          }
        }
        // Fallthrough to Params
        this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_PARAM;
        this.stack[framePtr + FRAME_OFFSET_ITERATOR] = 0;
        continue;
      } else if (stage === STAGE_PARAM) {
        // --- 3. PARAM CHILDREN ---
        const base = nodeIdx * NODE_STRIDE;
        const meta = this.nodeBuffer[base + NODE_OFFSET_META]!;
        const paramCount = (meta & NODE_MASK_PARAM_COUNT) >>> NODE_SHIFT_PARAM_COUNT;

        const iter = this.stack[framePtr + FRAME_OFFSET_ITERATOR]!;
        if (iter >= paramCount) {
          this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_WILDCARD;
          continue;
        }
        this.stack[framePtr + FRAME_OFFSET_ITERATOR] = iter + 1;

        const paramPtr = this.nodeBuffer[base + NODE_OFFSET_PARAM_CHILD_PTR]!;
        const childIdx = this.paramChildrenBuffer[paramPtr + iter]!;

        const childBase = childIdx * NODE_STRIDE;
        const paramInfoIdx = this.nodeBuffer[childBase + NODE_OFFSET_MATCH_FUNC]!;
        const pBase = paramInfoIdx * PARAM_ENTRY_STRIDE;
        const nameID = this.paramsBuffer[pBase]!;
        const patternID = this.paramsBuffer[pBase + 1]!;

        const name = this.getString(nameID);
        const value = this.decodeAndCache(segIdx, decodeParams);

        if (value === undefined) {
          continue;
        }

        // Regex Check
        if (patternID !== 0xffffffff) {
          const tester = this.patternTesters[patternID];
          if (tester && !tester(value)) {
            continue;
          }
        }

        // Capture Param
        this.paramNames[this.paramCount] = name;
        this.paramValues[this.paramCount] = value;
        this.paramCount++;

        // Push Child Frame
        this.stack[sp + FRAME_OFFSET_NODE] = childIdx;
        this.stack[sp + FRAME_OFFSET_SEGMENT] = segIdx + 1;
        this.stack[sp + FRAME_OFFSET_STAGE] = STAGE_ENTER;
        this.stack[sp + FRAME_OFFSET_PARAM_BASE] = this.paramCount;
        this.stack[sp + FRAME_OFFSET_ITERATOR] = 0;
        sp += FRAME_SIZE;
        continue;
      } else if (stage === STAGE_WILDCARD) {
        // --- 4. WILDCARD CHILD ---
        const base = nodeIdx * NODE_STRIDE;
        const wildcardPtr = this.nodeBuffer[base + NODE_OFFSET_WILDCARD_CHILD_PTR]!;

        if (wildcardPtr !== 0) {
          const childBase = wildcardPtr * NODE_STRIDE;
          const nameID = this.nodeBuffer[childBase + NODE_OFFSET_MATCH_FUNC]!;
          const name = this.getString(nameID);

          // Capture Remainder
          let value: string;
          const suffixPlan = suffixPlanFactory ? suffixPlanFactory() : undefined;
          
          if (suffixPlan && segIdx < suffixPlan.offsets.length) {
             const offset = suffixPlan.offsets[segIdx];
             value = suffixPlan.source.substring(offset!);
          } else {
             value = this.segments.slice(segIdx).join('/');
          }

          this.paramNames[this.paramCount] = name;
          this.paramValues[this.paramCount] = value;
          this.paramCount++;

          const childMethodsPtr = this.nodeBuffer[childBase + NODE_OFFSET_METHODS_PTR]!;
          if (childMethodsPtr > 0) {
            const mask = this.nodeBuffer[childBase + NODE_OFFSET_METHOD_MASK]!;
            if (this.methodCode < 31 && mask & (1 << this.methodCode)) {
              // Validate Multi vs Zero Origin
              const meta = this.nodeBuffer[childBase + NODE_OFFSET_META]!;
              const origin = (meta & NODE_MASK_WILDCARD_ORIGIN) >>> NODE_SHIFT_WILDCARD_ORIGIN;

              // Origin 1 = Multi (+), requires at least one segment
              if (origin === 1 && value.length === 0) {
                // Backtrack local state
                sp -= FRAME_SIZE;
                if (sp > 0) {
                  this.paramCount = this.stack[sp - FRAME_SIZE + FRAME_OFFSET_PARAM_BASE]!;
                }
                continue;
              }

              const count = (meta & NODE_MASK_METHOD_COUNT) >>> NODE_SHIFT_METHOD_COUNT;
              let ptr = childMethodsPtr;
              for (let i = 0; i < count; i++) {
                if (this.methodsBuffer[ptr] === this.methodCode) {
                  return this.methodsBuffer[ptr + 1]!;
                }
                ptr += 2;
              }
            }
          }
        }

        // Backtrack
        sp -= FRAME_SIZE;
        if (sp > 0) {
          this.paramCount = this.stack[sp - FRAME_SIZE + FRAME_OFFSET_PARAM_BASE]!;
        }
      }
    }
    return null;
  }

  /**
   * Optimization: Binary Search for static children
   * Threshold: 8 items. Below 8, linear scan is often faster due to locality/branch prediction.
   */
  private findStaticChild(staticPtr: number, staticCount: number, segment: string): number {
    if (staticCount < 8) {
      let ptr = staticPtr;
      for (let i = 0; i < staticCount; i++) {
        const sID = this.staticChildrenBuffer[ptr]!;
        // Direct string comparison is fast in JS engine (interned strings)
        if (this.getString(sID) === segment) {
          return this.staticChildrenBuffer[ptr + 1]!;
        }
        ptr += 2;
      }
    } else {
      let low = 0;
      let high = staticCount - 1;

      while (low <= high) {
        const mid = (low + high) >>> 1;
        const ptr = staticPtr + (mid << 1);
        const sID = this.staticChildrenBuffer[ptr]!;
        const midVal = this.getString(sID);

        if (midVal === segment) {
          return this.staticChildrenBuffer[ptr + 1]!;
        }

        if (midVal < segment) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
    }
    return -1;
  }
}

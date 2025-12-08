import { HttpMethod } from '../../enums';
import type { RouteKey } from '../../types';
import type { BinaryRouterLayout } from '../layout/binary-router-layout';
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
} from '../layout/binary-router-layout';
import type { DynamicMatchResult, EncodedSlashBehavior, PatternTesterFn, RouteParams, SuffixPlan } from '../types';
import { decodeURIComponentSafe } from '../utils/path-utils';

// Constants
const STAGE_ENTER = 0;
const STAGE_STATIC = 1;
const STAGE_PARAM = 2;
const STAGE_WILDCARD = 3;

const FRAME_SIZE = 5;
const FRAME_OFFSET_NODE = 0;
const FRAME_OFFSET_SEGMENT = 1;
const FRAME_OFFSET_STAGE = 2;
const FRAME_OFFSET_PARAM_BASE = 3;
const FRAME_OFFSET_ITERATOR = 4;

const MAX_STACK_DEPTH = 64;
const MAX_PARAMS = 32;

export class BinaryMatcher {
  // Layout Buffers
  private readonly nodeBuffer: Uint32Array;
  private readonly staticChildrenBuffer: Uint32Array;
  private readonly paramChildrenBuffer: Uint32Array;
  private readonly paramsBuffer: Uint32Array;
  private readonly methodsBuffer: Uint32Array;
  private readonly stringTable: ReadonlyArray<string>;
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
    this.rootIndex = layout.rootIndex;

    this.patternTesters = globalConfig.patternTesters;
    this.encodedSlashBehavior = globalConfig.encodedSlashBehavior;
    this.failFastOnBadEncoding = globalConfig.failFastOnBadEncoding;

    // Stack init
    this.stack = new Int32Array(MAX_STACK_DEPTH * FRAME_SIZE);
  }

  public exec(
    method: HttpMethod,
    segments: string[],
    segmentHints: Uint8Array | undefined,
    decodeParams: boolean,
    captureSnapshot: boolean,
    suffixPlanFactory?: () => SuffixPlan | undefined,
  ): DynamicMatchResult | null {
    // Reset State
    this.methodCode = method;
    this.segments = segments;
    this.segmentHints = segmentHints;
    this.paramCount = 0;

    // Clear Cache
    for (let i = 0; i < segments.length; i++) {
      this.paramCache[i] = undefined as any;
    }

    const key = this.walk(decodeParams, suffixPlanFactory);

    if (key === null) {
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
    return { key, params: bag, snapshot };
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

  private walk(decodeParams: boolean, suffixPlanFactory?: () => SuffixPlan | undefined): RouteKey | null {
    let sp = 0;

    // Push Root
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

      if (stage === STAGE_ENTER) {
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
                  return this.methodsBuffer[ptr + 1] as RouteKey;
                }
                ptr += 2;
              }
            }
          }
          this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_WILDCARD;
          continue;
        }
        this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_STATIC;
        continue;
      } else if (stage === STAGE_STATIC) {
        const base = nodeIdx * NODE_STRIDE;
        const staticArg = this.stack[framePtr + FRAME_OFFSET_ITERATOR]!;

        if (staticArg > 0) {
          this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_PARAM;
          this.stack[framePtr + FRAME_OFFSET_ITERATOR] = 0;
          continue;
        }
        this.stack[framePtr + FRAME_OFFSET_ITERATOR] = 1;

        const staticCount = this.nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_COUNT]!;
        if (staticCount > 0) {
          const staticPtr = this.nodeBuffer[base + NODE_OFFSET_STATIC_CHILD_PTR]!;
          const segment = this.segments[segIdx];
          let ptr = staticPtr;
          let childPtr = -1;
          // Look for match
          for (let i = 0; i < staticCount; i++) {
            const sID = this.staticChildrenBuffer[ptr]!;
            if (this.stringTable[sID] === segment) {
              childPtr = this.staticChildrenBuffer[ptr + 1]!;
              break;
            }
            ptr += 2;
          }

          if (childPtr !== -1) {
            this.stack[sp + FRAME_OFFSET_NODE] = childPtr;
            this.stack[sp + FRAME_OFFSET_SEGMENT] = segIdx + 1;
            this.stack[sp + FRAME_OFFSET_STAGE] = STAGE_ENTER;
            this.stack[sp + FRAME_OFFSET_PARAM_BASE] = this.paramCount;
            this.stack[sp + FRAME_OFFSET_ITERATOR] = 0;
            sp += FRAME_SIZE;
            continue;
          }
        }
        this.stack[framePtr + FRAME_OFFSET_STAGE] = STAGE_PARAM;
        this.stack[framePtr + FRAME_OFFSET_ITERATOR] = 0;
        continue;
      } else if (stage === STAGE_PARAM) {
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

        const name = this.stringTable[nameID]!;
        const value = this.decodeAndCache(segIdx, decodeParams);

        if (value === undefined) {
          continue;
        }

        if (patternID !== 0xffffffff) {
          const tester = this.patternTesters[patternID];
          if (tester && !tester(value)) {
            continue;
          }
        }

        this.paramNames[this.paramCount] = name;
        this.paramValues[this.paramCount] = value;
        this.paramCount++;

        this.stack[sp + FRAME_OFFSET_NODE] = childIdx;
        this.stack[sp + FRAME_OFFSET_SEGMENT] = segIdx + 1;
        this.stack[sp + FRAME_OFFSET_STAGE] = STAGE_ENTER;
        this.stack[sp + FRAME_OFFSET_PARAM_BASE] = this.paramCount;
        this.stack[sp + FRAME_OFFSET_ITERATOR] = 0;
        sp += FRAME_SIZE;
        continue;
      } else if (stage === STAGE_WILDCARD) {
        const base = nodeIdx * NODE_STRIDE;
        const wildcardPtr = this.nodeBuffer[base + NODE_OFFSET_WILDCARD_CHILD_PTR]!;

        if (wildcardPtr !== 0) {
          const childBase = wildcardPtr * NODE_STRIDE;
          const nameID = this.nodeBuffer[childBase + NODE_OFFSET_MATCH_FUNC]!;
          const name = this.stringTable[nameID]!;

          let value: string;
          const suffixPlan = suffixPlanFactory ? suffixPlanFactory() : undefined;
          if (suffixPlan) {
            value = this.segments.slice(segIdx).join('/'); // Simplified
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
              const meta = this.nodeBuffer[childBase + NODE_OFFSET_META]!;

              // Check Wildcard Origin (Multi vs Zero)
              const origin = (meta & NODE_MASK_WILDCARD_ORIGIN) >>> NODE_SHIFT_WILDCARD_ORIGIN;
              if (origin === 1 && value.length === 0) {
                // Multi (+) requires non-empty
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
                  return this.methodsBuffer[ptr + 1] as RouteKey;
                }
                ptr += 2;
              }
            }
          }
        }

        sp -= FRAME_SIZE;
        if (sp > 0) {
          this.paramCount = this.stack[sp - FRAME_SIZE + FRAME_OFFSET_PARAM_BASE]!;
        }
      }
    }
    return null;
  }
}

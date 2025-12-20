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
import type { EncodedSlashBehavior, PatternTesterFn, RouteParams } from '../types';

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

  private readonly stack: Int32Array;
  private paramNames: string[] = new Array(MAX_PARAMS);
  private paramValues: string[] = new Array(MAX_PARAMS);
  private paramCache: string[] = new Array(MAX_STACK_DEPTH);
  private paramCount = 0;

  private readonly decoder = new TextDecoder();
  private readonly decodedStrings: string[];

  private methodCode: number = 0;
  private segments!: string[];
  private segmentHints: Uint8Array | undefined;

  private normalizedPath!: string;
  private suffixOffsets: Uint32Array | null = null;

  private resultHandlerIndex: number = -1;
  private resultParams: RouteParams | null = null;
  private resultSnapshot: Array<[string, string | undefined]> | undefined;

  constructor(
    layout: BinaryRouterLayout,
    globalConfig: {
      patternTesters: ReadonlyArray<PatternTesterFn | undefined>;
      encodedSlashBehavior: EncodedSlashBehavior;
      failFastOnBadEncoding: boolean;
    },
  ) {

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

    this.stack = new Int32Array(MAX_STACK_DEPTH * FRAME_SIZE);

    this.decodedStrings = [];
  }

  public match(
    method: HttpMethod,
    segments: string[],
    normalizedPath: string,
    segmentHints: Uint8Array | undefined,
    decodeParams: boolean,
    captureSnapshot: boolean,
  ): boolean {

    const code = METHOD_OFFSET[method];
    if (code === undefined) {
      return false; 
    }
    this.methodCode = code;
    this.segments = segments;
    this.normalizedPath = normalizedPath;
    this.segmentHints = segmentHints;
    this.suffixOffsets = null; 
    this.paramCount = 0;

    for (let i = 0; i < segments.length; i++) {
      this.paramCache[i] = undefined as unknown as string;
    }

    const handlerIndex = this.walk(decodeParams);

    if (handlerIndex === null) {
      return false;
    }

    const bag: RouteParams = {};
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

    this.resultHandlerIndex = handlerIndex;
    this.resultParams = bag;
    this.resultSnapshot = snapshot;
    return true;
  }

  public getHandlerIndex(): number {
    return this.resultHandlerIndex;
  }

  public getParams(): RouteParams {
    return this.resultParams!;
  }

  public getSnapshot(): Array<[string, string | undefined]> | undefined {
    return this.resultSnapshot;
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

  private getSuffixValue(segIdx: number): string {

    if (!this.suffixOffsets) {
      const segments = this.segments;
      const offsets = new Uint32Array(segments.length + 1);
      let ptr = 1; 
      for (let i = 0; i < segments.length; i++) {
        offsets[i] = ptr;
        ptr += segments[i]!.length + 1; 
      }
      offsets[segments.length] = ptr;
      this.suffixOffsets = offsets;
    }

    const offset = this.suffixOffsets[segIdx];

    return this.normalizedPath.substring(offset!);
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

  private walk(decodeParams: boolean): number | null {
    let sp = 0;

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
                  return this.methodsBuffer[ptr + 1]!;
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
        const stateIter = this.stack[framePtr + FRAME_OFFSET_ITERATOR]!;

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

        const name = this.getString(nameID);
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
          const name = this.getString(nameID);

          const value = this.getSuffixValue(segIdx);

          this.paramNames[this.paramCount] = name;
          this.paramValues[this.paramCount] = value;
          this.paramCount++;

          const childMethodsPtr = this.nodeBuffer[childBase + NODE_OFFSET_METHODS_PTR]!;
          if (childMethodsPtr > 0) {
            const mask = this.nodeBuffer[childBase + NODE_OFFSET_METHOD_MASK]!;
            if (this.methodCode < 31 && mask & (1 << this.methodCode)) {

              const meta = this.nodeBuffer[childBase + NODE_OFFSET_META]!;
              const origin = (meta & NODE_MASK_WILDCARD_ORIGIN) >>> NODE_SHIFT_WILDCARD_ORIGIN;

              if (origin === 1 && value.length === 0) {

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

        sp -= FRAME_SIZE;
        if (sp > 0) {
          this.paramCount = this.stack[sp - FRAME_SIZE + FRAME_OFFSET_PARAM_BASE]!;
        }
      }
    }
    return null;
  }

  private findStaticChild(staticPtr: number, staticCount: number, segment: string): number {
    if (staticCount < 8) {
      let ptr = staticPtr;
      for (let i = 0; i < staticCount; i++) {
        const sID = this.staticChildrenBuffer[ptr]!;

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
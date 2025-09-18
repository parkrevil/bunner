import type { FFIFunction } from 'bun:ffi';

import type { AppId, FreePointerFn } from './types';

/**
 * Base FFI Symbols
 * @description The base symbols for a Rust core
 */
export interface BaseFfiSymbols {
  construct: (...args: any[]) => AppId | null;
  destroy: (appId: AppId) => void;
  free: FreePointerFn;
}

/**
 * FFI Error Report
 * @description The structure of an error report from FFI
 */
export interface FfiErrorReport {
  code: number;
  error: string;
  subsystem: string;
  stage: string;
  cause: string;
  ts: number;
  thread: string;
  version: string;
  description: string;
  extra: any;
}

export interface CreateJsCallbackOptions extends FFIFunction {
  callOnce?: boolean;
}

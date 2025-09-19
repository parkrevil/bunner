import type { FFIFunction } from 'bun:ffi';

import type { AppId, FreePointerFn } from './types';

/**
 * Base FFI Symbols
 * @description The base symbols for a Rust core
 */
export interface BaseFfiSymbols {
  init: (...args: any[]) => any;
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

/**
 * Create JS Callback Options
 * @description Options for creating a JS callback
 */
export interface CreateJsCallbackOptions extends FFIFunction {
  callOnce?: boolean;
}

/**
 * Base Construct Result
 * @description The result of constructing a Rust core
 */
export interface BaseInitResult {
  appId: AppId;
}

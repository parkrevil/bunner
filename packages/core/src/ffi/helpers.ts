import { BunnerFfiError } from './errors';
import type { FfiErrorReport } from './interfaces';

/**
 * Check if a value is an ffi error report
 * @description Check if a value is an ffi error report
 * @param error
 * @returns
 */
export function isFfiErrorReport(error: any): error is FfiErrorReport {
  return Object.hasOwn(error, 'code') && Object.hasOwn(error, 'error');
}

/**
 * Make an ffi error
 * @description Make an ffi error
 * @param error
 * @returns
 */
export function makeFfiError(error: FfiErrorReport) {
  if (!error.code) {
    return new BunnerFfiError('UnknownError', error);
  }

  return new BunnerFfiError(error.description, error);
}

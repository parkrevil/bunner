import { RustCoreError } from './errors';

/**
 * Convert a Rust core error code to an error message
 * @param errorCode
 * @returns
 */
export function toError(errorCode?: number) {
  if (errorCode === undefined) {
    return new Error(`UnknownError: ${errorCode}`);
  }

  if (errorCode === 0) {
    return undefined;
  }

  return new Error(RustCoreError[errorCode] ?? `UnknownError: ${errorCode}`);
}

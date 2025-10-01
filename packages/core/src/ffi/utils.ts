import { CString, read, suffix, type Pointer } from 'bun:ffi';
import { packageDirectorySync } from 'package-directory';

import { textEncoder } from '../common/instances';

import type { FfiStringable } from './types';

/**
 * Convert a value to a C string(for short values)
 * @param val - The value to convert
 * @returns The C string representation of the value
 */
export function toCString(val: FfiStringable) {
  const str = toString(val);
  const estimated = str.length * 4;
  const out = new Uint8Array(estimated + 1);
  const res = textEncoder.encodeInto(str, out.subarray(0));

  out[res.written] = 0;

  return out.subarray(0, res.written + 1);
}

/**
 * Convert a value to a buffer(for long values)
 * @param val - The value to convert
 * @returns The buffer prefixed with a 4-byte little-endian length
 */
export function toBuffer(val: FfiStringable) {
  const s = toString(val);
  const estimated = s.length * 4;
  const out = new Uint8Array(4 + estimated);

  // placeholder for length (little-endian)
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;

  const res = textEncoder.encodeInto(s, out.subarray(4));
  const len = res.written;

  out[0] = len & 0xff;
  out[1] = (len >>> 8) & 0xff;
  out[2] = (len >>> 16) & 0xff;
  out[3] = (len >>> 24) & 0xff;

  return out.subarray(0, 4 + len);
}

/**
 * Convert a value to a string
 * @param val - The value to convert
 * @returns The string representation of the value
 */
export function toString(val: FfiStringable) {
  if (typeof val === 'string') {
    return val;
  } else if (val instanceof Map) {
    return JSON.stringify(Array.from(val.entries()));
  }

  return JSON.stringify(val);
}

/**
 * Convert a pointer to a JSON object
 * @param ptr
 * @returns
 */
export function pointerToJson<T>(ptr: Pointer) {
  const length = read.u32(ptr, 0);

  return JSON.parse(new CString(ptr, 4, length).toString()) as T;
}

/**
 * Convert a pointer to a JSON object
 * @param ptr
 * @param length
 * @returns
 */
export function pointerToString(ptr: Pointer) {
  const length = read.u32(ptr, 0);

  return new CString(ptr, 4, length).toString();
}

/**
 * Resolve the path to a Rust library
 * @param libName - The name of the library
 * @param cwd - The current working directory
 * @returns The path to the library
 */
export function resolveRustLibPath(libName: string, cwd: string) {
  const fileName = process.platform === 'win32' ? `${libName}.dll` : `lib${libName}.${suffix}`;

  return `${packageDirectorySync({ cwd })}/bin/${fileName}`;
}

/**
 * Check if a value is a valid pointer
 * @param val - The value to check
 * @returns True if the value is a valid pointer, false otherwise
 */
export function isPointer(val: any): val is Pointer {
  return (typeof val === 'number' && isFinite(val) && val !== 0) || (typeof val === 'bigint' && val !== BigInt(0));
}

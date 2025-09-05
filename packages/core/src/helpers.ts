import { CString, suffix, type Pointer } from 'bun:ffi';
import { packageDirectorySync } from 'package-directory';

import { isDevelopment, isTest } from './constants';
import { textEncoder } from './instances';
import type { Class } from './types';

/**
 * Check if a target is a constructor
 * @param target - The target to check
 * @returns True if the target is a constructor, false otherwise
 */
export function isClass(target: any): target is Class {
  return typeof target === 'function' && target.prototype;
}

/**
 * Encode a string to a C string
 * @param message - The message to encode
 * @returns The encoded message
 */
export function encodeCString(message: string) {
  const bytes = textEncoder.encode(message);
  const buf = new Uint8Array(bytes.length + 1);

  buf.set(bytes);
  buf[bytes.length] = 0;

  return buf;
}

export function stringPointerToJson<T>(ptr: Pointer): T {
  const json = new CString(ptr);

  return JSON.parse(json.toString()) as T;
}

/**
 * Resolve the path to a Rust library
 * @param libName - The name of the library
 * @param cwd - The current working directory
 * @returns The path to the library
 */
export function resolveRustLibPath(libName: string, cwd: string) {
  const additionalName = isDevelopment || isTest ? '-dev' : '';
  const fileName =
    process.platform === 'win32'
      ? `${libName}${additionalName}.dll`
      : `lib${libName}${additionalName}.${suffix}`;

  return `${packageDirectorySync({ cwd })}/bin/${fileName}`;
}

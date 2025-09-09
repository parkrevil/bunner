import { CString, suffix, type Pointer } from 'bun:ffi';
import { packageDirectorySync } from 'package-directory';

import { IS_DEVELOPMENT, IS_TEST } from './constants';
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
export function encodeCString(
  message: string | object | Map<any, any> | any[],
) {
  let json: string;

  if (typeof message === 'string') {
    json = message;
  } else if (message instanceof Map) {
    json = JSON.stringify(Array.from(message.entries()));
  } else {
    json = JSON.stringify(message);
  }

  const bytes = textEncoder.encode(json);
  const buf = new Uint8Array(bytes.length + 1);

  buf.set(bytes);
  buf[bytes.length] = 0;

  return buf;
}

/**
 * Convert a pointer to a JSON object
 * @param ptr
 * @returns
 */
export function pointerToJson<T>(ptr: Pointer): T {
  const json = new CString(ptr);

  return JSON.parse(json.toString()) as T;
}

/**
 * Convert a pointer to a JSON object
 * @param ptr
 * @returns
 */
export function pointerToString(ptr: Pointer): string {
  return new CString(ptr).toString();
}

/**
 * Resolve the path to a Rust library
 * @param libName - The name of the library
 * @param cwd - The current working directory
 * @returns The path to the library
 */
export function resolveRustLibPath(libName: string, cwd: string) {
  const additionalName = IS_DEVELOPMENT || IS_TEST ? '-dev' : '';
  const fileName =
    process.platform === 'win32'
      ? `${libName}${additionalName}.dll`
      : `lib${libName}${additionalName}.${suffix}`;

  return `${packageDirectorySync({ cwd })}/bin/${fileName}`;
}

import { CString, suffix, type Pointer } from 'bun:ffi';
import { packageDirectorySync } from 'package-directory';

import { textEncoder } from '../instances';

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
export function pointerToJson<T>(ptr: Pointer, length?: number) {
  const json = new CString(ptr, 0, length);

  return JSON.parse(json.toString()) as T;
}

/**
 * Convert a pointer to a JSON object
 * @param ptr
 * @param length
 * @returns
 */
export function pointerToString(ptr: Pointer, length?: number) {
  return new CString(ptr, 0, length).toString();
}

/**
 * Resolve the path to a Rust library
 * @param libName - The name of the library
 * @param cwd - The current working directory
 * @returns The path to the library
 */
export function resolveRustLibPath(libName: string, cwd: string) {
  const fileName =
    process.platform === 'win32' ? `${libName}.dll` : `lib${libName}.${suffix}`;

  return `${packageDirectorySync({ cwd })}/bin/${fileName}`;
}

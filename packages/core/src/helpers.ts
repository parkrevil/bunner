import { suffix } from "bun:ffi";
import { textEncoder } from './instances';
import { packageDirectorySync } from 'package-directory';

export function encodeCString(message: string) {
  const bytes = textEncoder.encode(message);
  const buf = new Uint8Array(bytes.length + 1);

  buf.set(bytes);
  buf[bytes.length] = 0;

  return buf;
}

export function resolveRustLibPath(libName: string, cwd: string) {
  const fname = process.platform === 'win32' ? `${libName}.dll` : `lib${libName}.${suffix}`;

  return `${packageDirectorySync({ cwd })}/bin/${fname}`;
}

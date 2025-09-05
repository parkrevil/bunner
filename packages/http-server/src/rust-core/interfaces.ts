import type { FFIType, Pointer } from 'bun:ffi';

export interface HttpServerSymbols {
  init: () => Pointer | null;
  destroy: (handle: Pointer) => void;
  handle_request: (
    handle: Pointer,
    method: FFIType.u32,
    path: Uint8Array,
  ) => Pointer | null;
  router_add: (
    handle: Pointer,
    method: FFIType.u32,
    path: Uint8Array,
  ) => Pointer | null;
  router_seal: (handle: Pointer) => void;
  free_string: (ptr: Pointer) => void;
}

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

type RawMap = HashMap<usize, (usize, usize, String)>;

static REGISTRY: OnceLock<Mutex<RawMap>> = OnceLock::new();

fn registry() -> &'static Mutex<RawMap> {
    REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn has(ptr: *mut u8) -> bool {
    if ptr.is_null() {
        return false;
    }

    let addr = ptr as usize;
    let map = registry();
    let guard = map.lock().unwrap();
    let contains = guard.contains_key(&addr);
    let tag = guard.get(&addr);

    tracing::trace!(
        "pointer_registry: has_raw ptr={:p} addr=0x{:x} contains={} tag={:?}",
        ptr,
        addr,
        contains,
        tag
    );

    contains
}

/// Frees a previously-registered raw buffer.
///
/// # Safety
/// - `ptr` must be a pointer previously returned by `register` for a `Vec<u8>` that
///   was leaked into a raw pointer via `std::mem::forget` (the registry's `register`).
/// - The caller must ensure `ptr` has not already been freed; double-free is undefined
///   behavior (the registry will log and ignore unknown pointers, but callers should
///   not rely on this for correctness).
/// - Passing a null pointer is allowed and will be treated as a no-op.
pub unsafe fn free(ptr: *mut u8) {
    if ptr.is_null() {
        tracing::warn!("pointer_registry: free_raw called with null pointer");
        return;
    }

    let removed = {
        let map = registry();
        let mut guard = map.lock().unwrap();
        let before = guard.len();
        let removed = guard.remove(&(ptr as usize));

        tracing::trace!(
            "pointer_registry: free_raw requested ptr={:p} addr=0x{:x} removed={} before={}",
            ptr,
            ptr as usize,
            removed.is_some(),
            before
        );

        removed
    };

    if let Some((len, cap, tag)) = removed {
        unsafe {
            // Reconstruct Vec<u8> and drop it to free allocation.
            let _ = Vec::from_raw_parts(ptr, len, cap);
        }
        tracing::trace!("pointer_registry: freed raw ptr={:p} tag={}", ptr, tag);
    } else {
        tracing::warn!(
            "pointer_registry: free failed for ptr={:p} addr=0x{:x} (not registered)",
            ptr,
            ptr as usize,
        );
    }
}

/// Consume a `Vec<u8>`, register the raw pointer and metadata, and return it.
#[track_caller]
pub fn register(mut v: Vec<u8>) -> *mut u8 {
    let ptr = v.as_mut_ptr();
    let len = v.len();
    let cap = v.capacity();
    let addr = ptr as usize;
    let caller = std::panic::Location::caller();
    let tag = format!("{}:{}:{}", caller.file(), caller.line(), caller.column());
    let map = registry();
    let mut guard = map.lock().unwrap();

    guard.insert(addr, (len, cap, tag.clone()));

    std::mem::forget(v);

    tracing::trace!(
        "pointer_registry: raw_vec -> raw ptr={:p} addr=0x{:x} len={} cap={} tag={}",
        ptr,
        addr,
        len,
        cap,
        tag
    );

    ptr
}

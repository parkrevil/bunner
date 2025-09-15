//! Pointer registry for C strings allocated by this crate and passed over FFI.
//!
//! Thread-safe map of pointer address -> caller-site tag. Call `register`
//! after `CString::into_raw()`; use `free` or `unregister` to free/remove.
//! The registry logs failures but does not return errors.

use std::collections::HashMap;
use std::ffi::CString;
use std::os::raw::c_char;
use std::sync::{Mutex, OnceLock};

/// Global registry (Mutex-protected map of pointer addr -> caller tag).
static PTR_REGISTRY: OnceLock<Mutex<HashMap<usize, String>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<usize, String>> {
    PTR_REGISTRY.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Register a raw pointer returned from `CString::into_raw()`.
///
/// Null pointers are ignored. Records the caller site (file:line:col)
/// so frees/unregisters can be traced back to the creation site.
#[track_caller]
pub fn register(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }

    let addr = ptr as usize;

    let caller = std::panic::Location::caller();
    let tag = format!("{}:{}:{}", caller.file(), caller.line(), caller.column());

    let map = registry();
    let mut guard = map.lock().unwrap();
    let before = guard.len();
    guard.insert(addr, tag.clone());
    tracing::trace!(
        "pointer_registry: register ptr={:p} addr=0x{:x} tag={} before={} after={}",
        ptr,
        addr,
        tag,
        before,
        guard.len()
    );
}

/// Unregister a pointer.
/// If the pointer was not registered, a warning is logged.
/// Null pointers are ignored.
pub fn unregister(ptr: *mut c_char) {
    if ptr.is_null() {
        tracing::warn!("pointer_registry: unregister called with null pointer");
        return;
    }

    let addr = ptr as usize;

    let map = registry();
    let mut guard = map.lock().unwrap();
    let before = guard.len();
    let removed = guard.remove(&addr);
    if let Some(created_at) = removed {
        tracing::trace!("pointer_registry: unregister ptr={:p} addr=0x{:x} removed=true tag={} before={} after={}", ptr, addr, created_at, before, guard.len());
    } else {
        let caller = std::panic::Location::caller();
        let called_from = format!("{}:{}:{}", caller.file(), caller.line(), caller.column());
        let bt = std::backtrace::Backtrace::capture();
        tracing::warn!("pointer_registry: unregister failed for ptr={:p} addr=0x{:x} called_from={} backtrace={:?}", ptr, addr, called_from, bt);
    }
}

/// Check whether a pointer is registered.
pub fn has(ptr: *mut c_char) -> bool {
    if ptr.is_null() {
        return false;
    }

    let addr = ptr as usize;

    let map = registry();
    let guard = map.lock().unwrap();
    let contains = guard.contains_key(&addr);
    let tag = guard.get(&addr);
    tracing::trace!(
        "pointer_registry: has ptr={:p} addr=0x{:x} contains={} tag={:?}",
        ptr,
        addr,
        contains,
        tag
    );
    contains
}

/// Free a registered `CString` raw pointer.
///
/// If `ptr` was registered the registry removes it and calls
/// `CString::from_raw(ptr)` to free the allocation. If `ptr` is null or not
/// registered, a warning is logged and the function returns.
///
/// # Safety
/// - `ptr` must be a pointer previously returned from this crate.
pub unsafe fn free(ptr: *mut c_char) {
    if ptr.is_null() {
        tracing::warn!("pointer_registry: free called with null pointer");
        return;
    }

    let removed_tag = {
        let map = registry();
        let mut guard = map.lock().unwrap();
        let before = guard.len();
        let removed = guard.remove(&(ptr as usize));
        tracing::trace!(
            "pointer_registry: free requested ptr={:p} addr=0x{:x} removed={} before={}",
            ptr,
            ptr as usize,
            removed.is_some(),
            before
        );
        removed
    };

    if let Some(tag) = removed_tag {
        // Reconstruct CString to drop and free the allocation.
        unsafe {
            let _ = CString::from_raw(ptr);
        }
        tracing::trace!("pointer_registry: freed ptr={:p} tag={}", ptr, tag);
    } else {
        let caller = std::panic::Location::caller();
        let called_from = format!("{}:{}:{}", caller.file(), caller.line(), caller.column());
        let bt = std::backtrace::Backtrace::capture();
        tracing::warn!(
            "pointer_registry: free failed for ptr={:p} addr=0x{:x} called_from={} backtrace={:?}",
            ptr,
            ptr as usize,
            called_from,
            bt
        );
    }
}

/// Consume a `CString`, register the raw pointer, and return it.
#[track_caller]
pub fn register_cstring_and_into_raw(cstr: CString) -> *mut c_char {
    let ptr = cstr.into_raw();
    register(ptr);
    tracing::trace!(
        "pointer_registry: cstring -> raw ptr={:p} addr=0x{:x}",
        ptr,
        ptr as usize
    );
    ptr
}

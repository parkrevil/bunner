/// Pointer helpers for tests that need raw pointers.
use std::ptr;

/// Temporarily provide a raw pointer to the given Vec<u8> to a closure.
/// This does NOT transfer ownership; the Vec must outlive the closure.
pub fn with_raw_ptr<R, F: FnOnce(*const u8) -> R>(v: &Vec<u8>, f: F) -> R {
    let ptr = v.as_ptr();
    f(ptr)
}

/// Leak Vec<u8> and return raw pointer. Caller is responsible for reconstructing
/// the Vec and freeing it if desired. Use only in tests where explicit free is intended.
pub unsafe fn as_raw_ptr_owned(v: Vec<u8>) -> *const u8 {
    let p = v.as_ptr();
    std::mem::forget(v);
    p
}

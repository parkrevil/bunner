/// Temporarily provide a raw pointer to the given byte slice to a closure.
/// This does NOT transfer ownership; the slice's backing memory must outlive the closure.
pub fn with_raw_ptr<R, F: FnOnce(*const u8) -> R>(v: &[u8], f: F) -> R {
    let ptr = v.as_ptr();
    f(ptr)
}

/// Leak a `Vec<u8>` and return a raw pointer to its data.
///
/// # Safety
/// The caller takes ownership responsibility of the leaked `Vec<u8>`. The returned
/// pointer is valid for reads for the original `Vec` length but the memory will not
/// be freed unless the caller reconstructs the `Vec` using `Vec::from_raw_parts` and
/// drops it. Use only in tests where explicit cleanup is performed.
pub unsafe fn as_raw_ptr_owned(v: Vec<u8>) -> *const u8 {
    let p = v.as_ptr();
    std::mem::forget(v);
    p
}

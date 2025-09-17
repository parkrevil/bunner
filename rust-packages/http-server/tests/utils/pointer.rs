/// Temporarily provide a raw pointer to the given byte slice to a closure.
/// This does NOT transfer ownership; the slice's backing memory must outlive the closure.
pub fn with_raw_ptr<R, F: FnOnce(*const u8) -> R>(v: &[u8], f: F) -> R {
    let ptr = v.as_ptr();
    f(ptr)
}

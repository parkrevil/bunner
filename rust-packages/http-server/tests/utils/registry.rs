use crate::pointer_registry;

/// Helper: register a vec, run a closure with the raw pointer, then free it.
/// This reduces boilerplate in tests that need to operate on the raw pointer.
pub fn with_registered_vec<R, F>(data: Vec<u8>, f: F) -> R
where
    F: FnOnce(*mut u8) -> R,
{
    let ptr = pointer_registry::register(data);

    let res = f(ptr);

    // Best-effort cleanup; ignore double-free etc.
    unsafe { pointer_registry::free(ptr) };

    res
}

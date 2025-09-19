use crate::pointer_registry;
use crate::types::{MutablePointer, ReadonlyPointer, StaticString};
use crate::utils::string;

/// Helper: register a vec, run a closure with the raw pointer, then free it.
/// This reduces boilerplate in tests that need to operate on the raw pointer.
pub fn with_registered_vec<R, F>(data: Vec<u8>, f: F) -> R
where
    F: FnOnce(MutablePointer) -> R,
{
    let ptr = pointer_registry::register(data);

    let res = f(ptr);

    // Best-effort cleanup; ignore double-free etc.
    unsafe { pointer_registry::free(ptr) };

    res
}

/// Read a len-prefixed string from a registered pointer and free it.
/// Returns `Err(InternalErrorCode)` if reading fails.
/// # Safety
/// - `ptr` must be a valid pointer previously obtained from `pointer_registry::register`
/// - The pointer must be a len-prefixed buffer as expected by `len_prefixed_pointer_to_string`
pub unsafe fn read_string_and_free(ptr: MutablePointer) -> Result<String, StaticString> {
    // Interpret pointer as const for the string reader
    let s = unsafe {
        string::len_prefixed_pointer_to_string(ptr as ReadonlyPointer)
            .map_err(|_| StaticString::from("Invalid JSON string"))?
    };
    unsafe { pointer_registry::free(ptr) };
    Ok(s)
}

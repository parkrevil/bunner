use crate::types::ErrorString;
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

/// Read a len-prefixed string from a registered pointer and free it.
/// Returns `Err(InternalErrorCode)` if reading fails.
/// # Safety
/// - `ptr` must be a valid pointer previously obtained from `pointer_registry::register`
/// - The pointer must be a len-prefixed buffer as expected by `len_prefixed_pointer_to_string`
pub unsafe fn read_string_and_free(ptr: *mut u8) -> Result<String, ErrorString> {
    // Interpret pointer as const for the string reader
    let s = unsafe { crate::utils::string::len_prefixed_pointer_to_string(ptr as *const u8).map_err(|_| ErrorString::from("Invalid JSON string"))? };
    unsafe { pointer_registry::free(ptr) };
    Ok(s)
}

use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
    str::Utf8Error,
};

/// # Safety
/// - `value` must be a valid, non-null, null-terminated C string pointer.
/// - The caller must guarantee the pointer lives long enough for this call.
///
/// This function dereferences a raw pointer and therefore is `unsafe`.
pub unsafe fn cstr_to_str<'a>(value: *const c_char) -> Result<&'a str, Utf8Error> {
    unsafe { CStr::from_ptr(value).to_str() }
}

/// # Safety
/// - `ptr` must be a pointer previously returned from this crate (Rust-allocated C string).
/// - Must not be used after calling this function; ownership is transferred and freed here.
pub unsafe fn free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

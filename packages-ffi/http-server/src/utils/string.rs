use std::{ffi::CStr, os::raw::c_char, str::Utf8Error};

/// # Safety
/// - `value` must be a valid, non-null, null-terminated C string pointer.
/// - The caller must guarantee the pointer lives long enough for this call.
///
/// This function dereferences a raw pointer and therefore is `unsafe`.
pub unsafe fn cstr_to_str<'a>(value: *const c_char) -> Result<&'a str, Utf8Error> {
    unsafe { CStr::from_ptr(value).to_str() }
}

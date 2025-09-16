use crate::errors::internal_error::InternalErrorCode;
use crate::pointer_registry;
use std::{ffi::CStr, os::raw::c_char, str::Utf8Error};

/// # Safety
/// - `value` must be a valid, non-null, null-terminated C string pointer.
/// - The caller must guarantee the pointer lives long enough for this call.
///
/// This function dereferences a raw pointer and therefore is `unsafe`.
pub unsafe fn cstr_to_str<'a>(value: *const c_char) -> Result<&'a str, Utf8Error> {
    unsafe { CStr::from_ptr(value).to_str() }
}

/// # Safety
/// `ptr` must be a valid pointer to at least 4 bytes (the length header). The memory for
/// length+payload must be valid for reads of `4 + len` bytes and the payload must be
/// valid UTF-8.
/// Read a 4-byte little-endian length-prefixed buffer and deserialize JSON into T.
pub fn len_prefixed_pointer_to_string(ptr: *const u8) -> Result<String, InternalErrorCode> {
    if ptr.is_null() {
        tracing::error!("len_prefixed_ptr_deserialize: ptr is null");

        return Err(InternalErrorCode::PointerIsNull);
    }

    let header = unsafe { std::slice::from_raw_parts(ptr, 4) };
    let len = u32::from_le_bytes([header[0], header[1], header[2], header[3]]) as usize;
    let data_ptr = unsafe { ptr.add(4) };
    let bytes = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let s = match std::str::from_utf8(bytes) {
        Ok(v) => v.to_string(),
        Err(_) => return Err(InternalErrorCode::InvalidJsonString),
    };

    Ok(s)
}

pub fn string_to_len_prefixed_buffer(s: &str) -> *mut u8 {
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut v: Vec<u8> = Vec::with_capacity(4 + len);

    v.extend_from_slice(&(len as u32).to_le_bytes());
    v.extend_from_slice(bytes);

    pointer_registry::register(v)
}

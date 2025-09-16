use std::{ffi::CStr, os::raw::c_char, str::Utf8Error};
use serde::Serialize;
use serde::de::DeserializeOwned;
use crate::errors::internal_error::InternalErrorCode;
use crate::utils::json;


/// # Safety
/// - `value` must be a valid, non-null, null-terminated C string pointer.
/// - The caller must guarantee the pointer lives long enough for this call.
///
/// This function dereferences a raw pointer and therefore is `unsafe`.
pub unsafe fn cstr_to_str<'a>(value: *const c_char) -> Result<&'a str, Utf8Error> {
    unsafe { CStr::from_ptr(value).to_str() }
}

/// Read a 4-byte little-endian length-prefixed buffer and return the contained string.
/// # Safety
/// `ptr` must be a valid pointer to at least 4 bytes (the length header). The memory for
/// length+payload must be valid for reads of `4 + len` bytes and the payload must be
/// valid UTF-8.
/// Read a 4-byte little-endian length-prefixed buffer and deserialize JSON into T.
/// # Safety
/// `ptr` must be a valid pointer to at least 4 bytes (the length header). The memory for
/// length+payload must be valid for reads of `4 + len` bytes and the payload must be
/// valid UTF-8 JSON matching type `T`.
pub unsafe fn len_prefixed_ptr_deserialize<T: DeserializeOwned>(ptr: *const u8) -> Result<T, InternalErrorCode> {
    if ptr.is_null() {
        tracing::error!("len_prefixed_ptr_deserialize: ptr is null");
        return Err(InternalErrorCode::PointerIsNull);
    }

    // Read 4-byte little-endian length
    let header = unsafe { std::slice::from_raw_parts(ptr, 4) };
    let len = u32::from_le_bytes([header[0], header[1], header[2], header[3]]) as usize;
    tracing::event!(tracing::Level::DEBUG, ptr=?ptr, claimed_len = len, "len_prefixed_ptr_deserialize: header read");
    let data_ptr = unsafe { ptr.add(4) };
    let bytes = unsafe { std::slice::from_raw_parts(data_ptr, len) };

    // Log a small preview (hex + attempt UTF-8 preview)
    let preview_len = std::cmp::min(len, 128);
    let preview_hex: String = bytes.iter().take(preview_len).map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ");
    let utf8_preview = match std::str::from_utf8(&bytes[..preview_len]) {
        Ok(s) => format!("OK: {}", s.chars().take(200).collect::<String>()),
        Err(e) => format!("ERR: {}", e),
    };
    tracing::event!(tracing::Level::DEBUG, preview_hex=%preview_hex, utf8_preview=%utf8_preview, "len_prefixed_ptr_deserialize: payload preview");

    // Convert to &str
    let s = match std::str::from_utf8(bytes) {
        Ok(v) => v,
        Err(_) => return Err(InternalErrorCode::InvalidJsonString),
    };

    json::deserialize::<T>(s)
}

/// Serialize a value to JSON, allocate a buffer prefixed with a 4-byte little-endian length,
/// and return a raw pointer to the heap buffer. The returned pointer must be freed by
/// reconstructing the Vec via `Vec::from_raw_parts(ptr, len_with_header, cap)` and dropping it,
/// or by providing a dedicated free function on the JS side.
pub fn serialize_and_to_len_prefixed_buffer<T: Serialize>(value: &T) -> *mut u8 {
    match crate::utils::json::serialize(value) {
        Ok(s) => {
            let bytes = s.as_bytes();
            let len = bytes.len();

            // allocate Vec with 4 + len
            let mut v: Vec<u8> = Vec::with_capacity(4 + len);
            v.extend_from_slice(&(len as u32).to_le_bytes());
            v.extend_from_slice(bytes);

            // Register the Vec with the pointer registry so it can be freed from JS via free_raw
            crate::pointer_registry::register(v)
        }
        Err(_) => std::ptr::null_mut(),
    }
}

use crate::constants::LENGTH_HEADER_BYTES;
use crate::types::{LengthHeaderSize, ReadonlyPointer, StaticString};

use super::ffi::read_length_at_pointer;

use std::{slice, str};

/// Read a length-prefixed buffer and deserialize JSON into T.
/// # Safety
/// - `ptr` must be a valid pointer to at least `LENGTH_HEADER_BYTES` bytes (the length header).
/// - The memory for length+payload must be valid for reads of `LENGTH_HEADER_BYTES + len` bytes and the payload
///   must be valid UTF-8.
///
pub unsafe fn len_prefixed_pointer_to_string(ptr: ReadonlyPointer) -> Result<String, StaticString> {
    if ptr.is_null() {
        return Err("Pointer is null");
    }

    let payload_len = unsafe { read_length_at_pointer(ptr)? as usize };
    let data_ptr = unsafe { ptr.add(LENGTH_HEADER_BYTES) };
    let bytes = unsafe { slice::from_raw_parts(data_ptr, payload_len) };

    // SAFETY: The FFI caller (TypeScript side) guarantees that the payload is valid UTF-8.
    // Therefore we intentionally use `str::from_utf8_unchecked` here to avoid an extra check.
    // This function is `unsafe` and the caller must uphold the UTF-8 guarantee.
    let s = unsafe { str::from_utf8_unchecked(bytes) };

    Ok(s.to_string())
}

pub fn string_to_len_prefixed_buffer(s: &str) -> Vec<u8> {
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut v: Vec<u8> = Vec::with_capacity(LENGTH_HEADER_BYTES + len);

    v.extend_from_slice(&(len as LengthHeaderSize).to_le_bytes());
    v.extend_from_slice(bytes);

    v
}

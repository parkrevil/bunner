use super::json::serialize;
use super::string::{len_prefixed_pointer_to_string, string_to_len_prefixed_buffer};
use crate::enums::LenPrefixedString;
use crate::pointer_registry;
use crate::types::LengthHeaderSize;
use crate::constants::LENGTH_HEADER_BYTES;
use crate::types::ErrorString;

use serde::Serialize;
use std::slice;

/// Serialize `value` to JSON string and return a len-prefixed raw pointer allocated/registered by Rust.
pub fn make_result<T: Serialize>(value: &T) -> *mut u8 {
    match serialize::<T>(value) {
        Ok(s) => {
            let v = string_to_len_prefixed_buffer(&s);

            pointer_registry::register(v)
        }
        Err(_) => std::ptr::null_mut(),
    }
}

/// # Safety
///
/// - `pointer` must be a valid pointer to at least `LENGTH_HEADER_BYTES` bytes of readable memory.
/// - The memory pointed to must remain valid for the duration of the call.
/// - Calling this function with a null or invalid pointer results in undefined behavior
///   in the caller context. The function returns an `Err` for a null pointer to allow
///   graceful handling.
pub unsafe fn read_length_at_pointer(pointer: *const u8) -> Result<LengthHeaderSize, ErrorString> {
    if pointer.is_null() {
        return Err("Pointer is null");
    }

    let header = unsafe { slice::from_raw_parts(pointer, LENGTH_HEADER_BYTES) };

    // ensure header length + payload length won't overflow when used later
    let mut header_arr = [0u8; std::mem::size_of::<LengthHeaderSize>()];
    header_arr.copy_from_slice(&header[..LENGTH_HEADER_BYTES]);
    let len = LengthHeaderSize::from_le_bytes(header_arr) as usize;
    let _ = len.checked_add(LENGTH_HEADER_BYTES).ok_or("length overflow")?;

    Ok(len as LengthHeaderSize)
}

/// Read a 4-byte little-endian length-prefixed buffer and return either a String or a Vec<u8>
/// depending on `threshold`.
///
/// - If payload_len <= threshold: copies/parses into a String via existing helper (safe path).
/// - If payload_len > threshold: takes ownership of the caller allocation via `Vec::from_raw_parts`
///   and returns a payload-only Vec<u8> (header stripped). Caller MUST have relinquished ownership
///   of the pointer and the allocation must be compatible with this allocator.
///
/// # Safety
/// - `ptr` must be a valid pointer to a length-prefixed buffer where the header is `LENGTH_HEADER_BYTES` bytes.
/// - For the Bytes variant the caller must have allocated the buffer with the same Rust allocator
///   used by this crate and must have relinquished ownership (must not use or free `ptr` afterwards).
pub unsafe fn take_len_prefixed_pointer(
    ptr: *const u8,
    threshold: usize,
) -> Result<LenPrefixedString, ErrorString> {
    if ptr.is_null() {
        return Err("pointer is null");
    }

    // read length header
    let payload_len_u32 = unsafe { read_length_at_pointer(ptr)? };
    let payload_len = payload_len_u32 as usize;

    if payload_len <= threshold {
        // safe copy path -> reuse existing helper that returns String
        let s = unsafe { len_prefixed_pointer_to_string(ptr)? };

        return Ok(LenPrefixedString::Text(s));
    }

    let data_ptr = unsafe { ptr.add(LENGTH_HEADER_BYTES) };
    let slice = unsafe { slice::from_raw_parts(data_ptr, payload_len) };
    let v = slice.to_vec();

    Ok(LenPrefixedString::Bytes(v))
}

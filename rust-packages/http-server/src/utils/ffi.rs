use super::json::serialize;
use super::string::{len_prefixed_pointer_to_string, string_to_len_prefixed_buffer};
use crate::enums::LenPrefixedString;
use crate::pointer_registry;

use serde::{Serialize};

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
/// - `pointer` must be a valid pointer to at least 4 bytes of readable memory.
/// - The memory pointed to must remain valid for the duration of the call.
/// - Calling this function with a null or invalid pointer results in undefined behavior
///   in the caller context. The function returns an `Err` for a null pointer to allow
///   graceful handling.
pub unsafe fn read_length_at_pointer(pointer: *const u8) -> Result<u32, &'static str> {
    if pointer.is_null() {
      return Err("Pointer is null");
    }

    let header = unsafe { std::slice::from_raw_parts(pointer, 4) };

    Ok(u32::from_le_bytes([header[0], header[1], header[2], header[3]]))
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
/// - `ptr` must be a valid pointer to a 4-byte little-endian length-prefixed buffer.
/// - For the Bytes variant the caller must have allocated the buffer with the same Rust allocator
///   used by this crate and must have relinquished ownership (must not use or free `ptr` afterwards).
pub unsafe fn take_len_prefixed_pointer(
    ptr: *const u8,
    threshold: usize,
) -> Result<LenPrefixedString, &'static str> {
    if ptr.is_null() {
        return Err("pointer is null");
    }

    // read length header
    let payload_len_u32 = unsafe { read_length_at_pointer(ptr)? };
    let payload_len = payload_len_u32 as usize;

    // simple bounds/overflow check
    let total = payload_len.checked_add(4).ok_or("length overflow")?;

    if payload_len <= threshold {
        // safe copy path -> reuse existing helper that returns String
        let s = unsafe { len_prefixed_pointer_to_string(ptr)? };
      
        return Ok(LenPrefixedString::Text(s));
    }

    // ownership-transfer path: take the whole allocation (header + payload)
    // Caller must guarantee allocator compatibility and relinquished ownership.
    let mut v = unsafe { Vec::from_raw_parts(ptr as *mut u8, total, total) };

    // remove 4-byte header in-place (this memmoves payload to start)
    {
        let _d = v.drain(0..4);

        drop(_d); // ensure drain is dropped so removal happens now
    }

    Ok(LenPrefixedString::Bytes(v))
}
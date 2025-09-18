/// Read a 4-byte little-endian length-prefixed buffer and deserialize JSON into T.
/// # Safety
/// - `ptr` must be a valid pointer to at least 4 bytes (the length header).
/// - The memory for length+payload must be valid for reads of `4 + len` bytes and the payload
///   must be valid UTF-8.
///
/// This function dereferences raw pointers and therefore is `unsafe`.
pub unsafe fn len_prefixed_pointer_to_string(ptr: *const u8) -> Result<String, &'static str> {
    if ptr.is_null() {
        tracing::error!("len_prefixed_ptr_deserialize: Pointer is null");

        return Err("Pointer is null");
    }

    let header = unsafe { std::slice::from_raw_parts(ptr, 4) };
    let len = u32::from_le_bytes([header[0], header[1], header[2], header[3]]) as usize;
    let data_ptr = unsafe { ptr.add(4) };
    let bytes = unsafe { std::slice::from_raw_parts(data_ptr, len) };
    let s = unsafe { std::str::from_utf8_unchecked(bytes) };

    Ok(s.to_string())
}

pub fn string_to_len_prefixed_buffer(s: &str) -> Vec<u8> {
    let bytes = s.as_bytes();
    let len = bytes.len();
    let mut v: Vec<u8> = Vec::with_capacity(4 + len);

    v.extend_from_slice(&(len as u32).to_le_bytes());
    v.extend_from_slice(bytes);

    v
}

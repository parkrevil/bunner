/// Test helpers for string and len-prefixed buffer operations.
pub fn make_len_prefixed_buf(s: &str) -> Vec<u8> {
    let bytes = s.as_bytes();
    let len = bytes.len() as u32;
    let mut v = Vec::with_capacity(4 + bytes.len());
    v.extend_from_slice(&len.to_le_bytes());
    v.extend_from_slice(bytes);
    v
}

pub fn make_large_string(size: usize) -> String {
    "x".repeat(size)
}

pub fn make_invalid_utf8_buf(len: u32) -> Vec<u8> {
    let mut v = Vec::with_capacity(4 + len as usize);
    v.extend_from_slice(&len.to_le_bytes());
    // fill with invalid utf8 bytes (0xff)
    v.extend(std::iter::repeat_n(0xffu8, len as usize));
    v
}

pub fn make_mismatched_len_buf(header_len: u32, payload: &[u8]) -> Vec<u8> {
    let mut v = Vec::with_capacity(4 + payload.len());
    v.extend_from_slice(&header_len.to_le_bytes());
    v.extend_from_slice(payload);
    v
}

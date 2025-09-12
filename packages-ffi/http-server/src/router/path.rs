#[inline]
#[tracing::instrument(level = "trace", skip(path), fields(path_len=path.len() as u64))]
pub(crate) fn normalize_and_validate_path(path: &str) -> Result<String, ()> {
    if !path.is_ascii() {
        return Err(());
    }
    let bytes = path.as_bytes();
    if bytes.is_empty() {
        return Err(());
    }
    let mut end = bytes.len();
    while end > 1 && bytes[end - 1] == b'/' {
        end -= 1;
    }

    // Validate allowed characters while scanning once
    for &b in &bytes[..end] {
        if b <= 0x20 {
            return Err(());
        }
        match b {
            b'a'..=b'z'
            | b'A'..=b'Z'
            | b'0'..=b'9'
            | b'-' | b'.' | b'_' | b'~'
            | b'!' | b'$' | b'&' | b'\'' | b'(' | b')'
            | b'*' | b'+' | b',' | b';' | b'=' | b':' | b'@'
            | b'/' | b'%' => {}
            _ => return Err(()),
        }
    }

    let normalized = if end == bytes.len() {
        path.to_string()
    } else {
        path[..end].to_string()
    };
    Ok(normalized)
}

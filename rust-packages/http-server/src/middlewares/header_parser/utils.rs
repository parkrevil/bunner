pub(super) fn first_header_value(header: &str) -> Option<String> {
    header
        .split(',')
        .next()
        .map(|segment| segment.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

pub(super) fn strip_surrounding_quotes(value: &str) -> String {
    let mut trimmed = value.trim();

    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        let first = bytes[0];
        let last = bytes[bytes.len() - 1];

        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            trimmed = &trimmed[1..trimmed.len() - 1];
        }
    }

    trimmed.trim().to_string()
}

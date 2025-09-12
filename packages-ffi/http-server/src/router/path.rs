#[tracing::instrument(level = "trace", skip(path), fields(path_len=path.len() as u64))]
pub(crate) fn normalize_path(path: &str) -> String {
    if path.len() <= 1 || path.as_bytes().last().is_none() || path.as_bytes().last() != Some(&b'/')
    {
        return path.to_string();
    }

    let mut end_position = path.len();

    while end_position > 1 && path.as_bytes()[end_position - 1] == b'/' {
        end_position -= 1;
    }

    if end_position == path.len() {
        return path.to_string();
    }

    path[..end_position].to_string()
}

#[inline]
#[tracing::instrument(level = "trace", skip(path), fields(path_len=path.len() as u64))]
pub(crate) fn is_path_character_allowed(path: &str) -> bool {
    for &byte_value in path.as_bytes() {
        if byte_value <= 0x20 {
            return false;
        }

        match byte_value {
            b'a'..=b'z'
            | b'A'..=b'Z'
            | b'0'..=b'9'
            | b'-'
            | b'.'
            | b'_'
            | b'~'
            | b'!'
            | b'$'
            | b'&'
            | b'\''
            | b'('
            | b')'
            | b'*'
            | b'+'
            | b','
            | b';'
            | b'='
            | b':'
            | b'@'
            | b'/' => {}
            _ => {
                return false;
            }
        }
    }
    true
}

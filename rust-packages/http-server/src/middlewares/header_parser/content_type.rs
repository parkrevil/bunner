use std::collections::HashMap;

use super::utils::strip_surrounding_quotes;

pub(super) fn parse_content_type(
    content_type: &str,
) -> Result<(String, HashMap<String, String>), &'static str> {
    let content_type = content_type.trim();

    if content_type.is_empty() {
        return Err("empty content-type");
    }

    let mut parts = content_type.splitn(2, ';');
    let media_type = parts.next().unwrap().trim().to_lowercase();

    if media_type.is_empty() {
        return Err("empty media type");
    }

    let mut parameters = HashMap::new();

    if let Some(params_str) = parts.next() {
        for param in params_str.split(';') {
            let param = param.trim();
            if param.is_empty() {
                continue;
            }

            let mut kv = param.splitn(2, '=');
            let key = kv
                .next()
                .map(|s| s.trim().to_lowercase())
                .ok_or("invalid parameter format")?;

            let value = kv
                .next()
                .map(|s| strip_surrounding_quotes(s.trim()))
                .unwrap_or_default();

            if !key.is_empty() && !parameters.contains_key(&key) {
                parameters.insert(key, value);
            }
        }
    }

    Ok((media_type, parameters))
}

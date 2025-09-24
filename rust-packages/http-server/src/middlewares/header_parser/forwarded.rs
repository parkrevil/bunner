use super::utils::strip_surrounding_quotes;

#[derive(Default)]
pub(super) struct ForwardedValues {
    pub(super) proto: Option<String>,
    pub(super) host: Option<String>,
    pub(super) client: Option<String>,
}

pub(super) fn parse_forwarded_values(header: &str) -> ForwardedValues {
    let mut values = ForwardedValues::default();
    let first_element = header.split(',').next().unwrap_or("");

    for segment in first_element.split(';') {
        let segment = segment.trim();
        if segment.is_empty() {
            continue;
        }

        let mut parts = segment.splitn(2, '=');
        let key = parts.next().unwrap_or("").trim().to_lowercase();
        if key.is_empty() {
            continue;
        }

        let raw_value = parts.next().unwrap_or("").trim();
        let cleaned = strip_surrounding_quotes(raw_value);

        match key.as_str() {
            "proto" => values.proto = Some(cleaned.to_lowercase()),
            "host" => values.host = Some(cleaned),
            "for" => values.client = Some(cleaned),
            _ => {}
        }
    }

    values
}

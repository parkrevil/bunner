use crate::enums::HttpStatusCode;
use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use std::sync::OnceLock;
use url::Url;

static QS_CONFIG: OnceLock<serde_qs::Config> = OnceLock::new();

fn is_valid_name_segment(seg: &str) -> bool {
    if seg.is_empty() {
        return false;
    }
    seg.bytes().all(|c| {
        matches!(c,
            b'A'..=b'Z' |
            b'a'..=b'z' |
            b'0'..=b'9' |
            b'_' | b'-'
        )
    })
}

fn is_valid_bracket_key(key: &str) -> bool {
    if key.is_empty() {
        return false;
    }

    let bytes = key.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() && bytes[i] != b'[' {
        i += 1;
    }
    let base = &key[..i];
    if !is_valid_name_segment(base) {
        return false;
    }

    while i < bytes.len() {
        if bytes[i] != b'[' {
            return false;
        }
        i += 1;
        let start = i;
        while i < bytes.len() && bytes[i] != b']' {
            i += 1;
        }
        if i >= bytes.len() {
            return false;
        }
        let seg = &key[start..i];
        if !seg.is_empty() && !is_valid_name_segment(seg) {
            return false;
        }
        i += 1;
    }
    true
}

pub struct UrlParser;

impl Middleware for UrlParser {
    #[tracing::instrument(level = "trace", skip(self, req, res, payload), fields(url=%payload.url))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation="url_parser", url=%payload.url);
        let u = match Url::parse(payload.url.as_str()) {
            Ok(u) => u,
            Err(_) => {
                res.http_status = HttpStatusCode::BadRequest;
                res.body = serde_json::Value::String(
                    HttpStatusCode::BadRequest.reason_phrase().to_string(),
                );
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "url_parser_reject",
                    reason = "url_parse_error"
                );
                return false;
            }
        };

        req.path = u.path().to_string();

        if let Some(q) = u.query() {
            let mut seen = std::collections::HashSet::new();
            for (k, v) in u.query_pairs() {
                let k_str = k.as_ref();
                if k_str.is_empty() {
                    res.http_status = HttpStatusCode::BadRequest;
                    res.body = serde_json::Value::String(
                        HttpStatusCode::BadRequest.reason_phrase().to_string(),
                    );
                    return false;
                }
                if !is_valid_bracket_key(k_str) {
                    res.http_status = HttpStatusCode::BadRequest;
                    res.body = serde_json::Value::String(
                        HttpStatusCode::BadRequest.reason_phrase().to_string(),
                    );
                    return false;
                }
                let is_array_key = k_str.contains("[]");
                if !is_array_key && !seen.insert(k_str.to_string()) {
                    res.http_status = HttpStatusCode::BadRequest;
                    res.body = serde_json::Value::String(
                        HttpStatusCode::BadRequest.reason_phrase().to_string(),
                    );
                    return false;
                }
                let _ = v;
            }

            let config = QS_CONFIG.get_or_init(|| serde_qs::Config::new(5, true));
            match config.deserialize_str::<std::collections::HashMap<String, serde_json::Value>>(q)
            {
                Ok(map) => {
                    let mut obj = serde_json::Map::new();
                    for (k, v) in map {
                        obj.insert(k, v);
                    }
                    req.query_params = Some(serde_json::Value::Object(obj));
                }
                Err(_) => {
                    res.http_status = HttpStatusCode::BadRequest;
                    res.body = serde_json::Value::String(
                        HttpStatusCode::BadRequest.reason_phrase().to_string(),
                    );
                    tracing::event!(
                        tracing::Level::TRACE,
                        operation = "url_parser_reject",
                        reason = "qs_deserialize_error"
                    );
                    return false;
                }
            }
        }

        true
    }
}

use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use url::Url;

pub struct HeaderParser;

impl Middleware for HeaderParser {
    fn handle(&self, req: &mut BunnerRequest, _res: &mut BunnerResponse, payload: &HandleRequestPayload) {
        if let Some(map) = req.headers.as_object_mut() {
            let original = std::mem::take(map);
            let mut normalized = serde_json::Map::new();
            for (k, v) in original.into_iter() {
                normalized.insert(k.to_ascii_lowercase(), v);
            }
            req.headers = serde_json::Value::Object(normalized);
        }

        // http protocol
        let protocol = req.headers
            .get("x-forwarded-proto")
            .or_else(|| req.headers.get("x-forwarded-protocol"))
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .or_else(|| Url::parse(req.url.as_str()).ok().map(|u| u.scheme().to_string()))
            .unwrap_or_else(|| "http".to_string());
        req.http_protocol = protocol;

        // http version
        let version = req.headers
            .get("x-http-version")
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "1.1".to_string());
        req.http_version = version;

        // ip and version
        let ip = req.headers
            .get("x-forwarded-for")
            .and_then(|v| v.as_str())
            .and_then(|v| v.split(',').next().map(|s| s.trim().to_string()))
            .or_else(|| req.headers.get("x-real-ip").and_then(|v| v.as_str().map(|s| s.to_string())))
            .unwrap_or_default();
        if !ip.is_empty() {
            req.ip_version = if ip.contains(':') { 6u8 } else { 4u8 };
            req.ip = ip;
        }

        // content-type and charset move to header parser
        if let Some(ct) = payload.headers.get("content-type") {
            let mut ct_main = ct.as_str();
            if let Some(sc_pos) = ct.find(';') {
                ct_main = &ct[..sc_pos];
                for param in ct[sc_pos + 1..].split(';') {
                    let mut kv = param.splitn(2, '=');
                    let k = kv.next().map(|s| s.trim().to_ascii_lowercase()).unwrap_or_default();
                    let v = kv.next().map(|s| s.trim().trim_matches('"')).unwrap_or("");
                    if k == "charset" { req.charset = v.to_string(); }
                }
            }
            req.content_type = ct_main.trim().to_string();
        }
    }
}


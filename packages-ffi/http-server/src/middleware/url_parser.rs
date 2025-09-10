use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use url::Url;

pub struct UrlParser;

impl Middleware for UrlParser {
    fn handle(&self, req: &mut BunnerRequest, _res: &mut BunnerResponse, payload: &HandleRequestPayload) -> bool {
        // TODO: Validate URL here and surface structured errors via request fields (no side-channel keys)
        // Parse URL
        if let Ok(u) = Url::parse(payload.url.as_str()) {
            req.path = u.path().to_string();
            if let Some(q) = u.query() {
                let mut map = serde_json::Map::new();
                for part in q.split('&') {
                    if part.is_empty() { continue; }
                    let mut it = part.splitn(2, '=');
                    let k = it.next().unwrap_or("");
                    let v = it.next().unwrap_or("");
                    map.insert(k.to_string(), serde_json::Value::String(v.to_string()));
                }
                if !map.is_empty() {
                    req.query_params = Some(serde_json::Value::Object(map));
                } else {
                    req.query_params = None;
                }

                // TODO: Implement robust query validation and surface precise parse errors via a typed field on BunnerRequest
            }
            // host/hostname/port
            req.host = payload.headers.get("host").cloned().unwrap_or_else(|| u.host_str().unwrap_or("").to_string());
            req.hostname = u.host_str().unwrap_or("").to_string();
            req.port = u.port_or_known_default();
        } else {
            // TODO: Surface invalid URL error via a typed field on BunnerRequest
        }
        true
    }
}


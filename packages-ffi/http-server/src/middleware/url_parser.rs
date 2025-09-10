use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use url::Url;

pub struct UrlParser;

impl Middleware for UrlParser {
    fn handle(&self, req: &mut BunnerRequest, _res: &mut BunnerResponse, payload: &HandleRequestPayload) {
        if let Ok(u) = Url::parse(payload.url.as_str()) {
            req.path = u.path().to_string();
            if let Some(q) = u.query() {
                req.query_params = serde_qs::from_str::<serde_json::Value>(q).ok();
            }
            // host/hostname/port
            req.host = payload.headers.get("host").cloned().unwrap_or_else(|| u.host_str().unwrap_or("").to_string());
            req.hostname = u.host_str().unwrap_or("").to_string();
            req.port = u.port_or_known_default();
        }
    }
}


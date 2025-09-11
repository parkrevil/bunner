use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};

pub struct HeaderParser;

impl Middleware for HeaderParser {
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        req.headers = serde_json::to_value(&payload.headers)
            .unwrap_or_else(|_| serde_json::Value::Object(serde_json::Map::new()));

        // content-type and charset
        if let Some(ct) = payload.headers.get("content-type") {
            let mut ct_main = ct.as_str();
            if let Some(sc_pos) = ct.find(';') {
                ct_main = &ct[..sc_pos];

                for param in ct[sc_pos + 1..].split(';') {
                    let mut kv = param.splitn(2, '=');
                    let k = kv
                        .next()
                        .map(|s| s.trim().to_ascii_lowercase())
                        .unwrap_or_default();
                    let v = kv.next().map(|s| s.trim().trim_matches('"')).unwrap_or("");

                    if k == "charset" {
                        req.charset = Some(v.to_string());
                    }
                }
            }

            req.content_type = Some(ct_main.trim().to_string());
        }

        if let Some(ct) = payload.headers.get("content-length") {
            req.content_length = Some(ct.parse::<u64>().unwrap_or(0));
        }

        true
    }
}

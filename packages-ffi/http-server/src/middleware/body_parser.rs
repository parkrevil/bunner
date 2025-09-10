use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::Value as JsonValue;

pub struct BodyParser;

impl Middleware for BodyParser {
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        if let Some(ref s) = payload.body {
            let ct_lc = req.content_type.to_ascii_lowercase();
            let looks_like_json =
                s.trim_start().starts_with('{') || s.trim_start().starts_with('[');
            let ct_is_json = !ct_lc.is_empty() && ct_lc.contains("json");

            if ct_is_json || looks_like_json {
                match serde_json::from_str::<JsonValue>(s) {
                    Ok(v) => req.body = Some(v),
                    Err(_) => req.body = Some(JsonValue::String(s.clone())),
                }
            } else {
                req.body = Some(JsonValue::String(s.clone()));
            }
        }
        true
    }
}

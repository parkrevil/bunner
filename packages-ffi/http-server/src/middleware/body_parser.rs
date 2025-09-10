use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::Value as JsonValue;

pub struct BodyParser;

impl Middleware for BodyParser {
    fn handle(&self, req: &mut BunnerRequest, _res: &mut BunnerResponse, payload: &HandleRequestPayload) {
        if let Some(ref s) = payload.body {
            if req.content_type == "application/json" {
                match serde_json::from_str::<JsonValue>(s) {
                    Ok(v) => req.body = Some(v),
                    Err(_) => req.body = Some(JsonValue::String(s.clone())),
                }
            } else {
                req.body = Some(JsonValue::String(s.clone()));
            }
        }
    }
}


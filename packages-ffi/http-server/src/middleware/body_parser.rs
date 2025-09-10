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
        if payload.body.is_some() {
            return true;
        }

        let body = payload.body.as_ref().unwrap();

        if let Ok(v) = serde_json::from_str::<JsonValue>(body) {
            req.body = Some(v);
        }

        true
    }
}

use crate::middleware::chain::Middleware;
use crate::r#enum::HttpStatusCode;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::Value as JsonValue;

pub struct BodyParser;

impl Middleware for BodyParser {
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
      if payload.body.is_none() {
        return true;
      }

      let body = payload.body.as_ref().unwrap();

      match serde_json::from_str::<JsonValue>(body) {
          Ok(v) => req.body = Some(v),
          Err(_) => {
            res.http_status = HttpStatusCode::UnsupportedMediaType;
            res.body = serde_json::Value::String(HttpStatusCode::UnsupportedMediaType.reason_phrase().to_string());

            return false;
          },
      }
        true
    }
}

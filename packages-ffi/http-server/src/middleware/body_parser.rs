use crate::enums::HttpStatusCode;
use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use serde_json::Value as JsonValue;
#[cfg(feature = "simd-json")]
use simd_json as simdjson;

pub struct BodyParser;

impl Middleware for BodyParser {
    #[tracing::instrument(level = "trace", skip(self, req, res, payload), fields(has_body=payload.body.is_some()))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(
            tracing::Level::TRACE,
            operation = "body_parser",
            has_body = payload.body.is_some()
        );
        if payload.body.is_none() {
            return true;
        }

        let body = payload.body.as_ref().unwrap();
        // Only parse JSON when explicit application/json
        let content_type = req
            .headers
            .get("content-type")
            .map(|ct| {
                ct.split(';')
                    .next()
                    .unwrap_or("")
                    .trim()
                    .to_ascii_lowercase()
            });

        let is_json = content_type
            .as_ref()
            .map(|ct| ct == "application/json")
            .unwrap_or(false);

        if is_json {
            #[cfg(feature = "simd-json")]
            let parsed: Result<JsonValue, _> = {
                let mut body_str = body.clone();
                unsafe { simdjson::from_str(&mut body_str) }
            };
            #[cfg(not(feature = "simd-json"))]
            let parsed: Result<JsonValue, _> = serde_json::from_str(body);

            match parsed {
                Ok(v) => req.body = Some(v),
                Err(_) => {
                    res.http_status = HttpStatusCode::UnsupportedMediaType;
                    res.body = serde_json::Value::String(
                        HttpStatusCode::UnsupportedMediaType
                            .reason_phrase()
                            .to_string(),
                    );
                    tracing::event!(
                        tracing::Level::TRACE,
                        operation = "body_parser_reject",
                        reason = "invalid_json"
                    );
                    return false;
                }
            }
        } else if content_type.is_some() {
            // Reject non-JSON content types when there's a body
            res.http_status = HttpStatusCode::UnsupportedMediaType;
            res.body = serde_json::Value::String(
                HttpStatusCode::UnsupportedMediaType
                    .reason_phrase()
                    .to_string(),
            );
            tracing::event!(
                tracing::Level::TRACE,
                operation = "body_parser_reject",
                reason = "non_json_content_type"
            );
            return false;
        }
        true
    }
}

use crate::enums::HttpStatusCode;
use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use crate::util::get_limits;
use std::sync::OnceLock;
use url::Url;

static QS_CONFIG: OnceLock<serde_qs::Config> = OnceLock::new();

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
            // Single-pass: rely on serde_qs to parse and avoid pre-validation iteration
            let limits = get_limits();
            let config = QS_CONFIG.get_or_init(|| serde_qs::Config::new(limits.qs_max_depth, true));
            match config.deserialize_str::<std::collections::HashMap<String, serde_json::Value>>(q)
            {
                Ok(map) => {
                    if map.len() > limits.qs_max_keys {
                        res.http_status = HttpStatusCode::BadRequest;
                        res.body = serde_json::Value::String(
                            HttpStatusCode::BadRequest.reason_phrase().to_string(),
                        );
                        return false;
                    }
                    let mut obj = serde_json::Map::new();
                    for (k, v) in map {
                        // Basic key validation; detailed bracket checks omitted in fast path
                        if k.is_empty() {
                            res.http_status = HttpStatusCode::BadRequest;
                            res.body = serde_json::Value::String(
                                HttpStatusCode::BadRequest.reason_phrase().to_string(),
                            );
                            return false;
                        }
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

use serde_qs::Config as QsConfig;
use std::sync::OnceLock;
use url::Url;

use crate::enums::HttpStatusCode;
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};

use super::Middleware;

static QS_CONFIG: OnceLock<serde_qs::Config> = OnceLock::new();

pub struct UrlParser;

impl UrlParser {
    /// 헬퍼 함수: 요청 거부 응답 생성
    fn reject_request(res: &mut BunnerResponse, status: HttpStatusCode) -> bool {
        res.http_status = status;
        res.body = serde_json::Value::String(status.reason_phrase().to_string());
        false
    }
}

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
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "url_parser_reject",
                    reason = "url_parse_error"
                );
                return Self::reject_request(res, HttpStatusCode::BadRequest);
            }
        };

        req.path = u.path().to_string();

        if let Some(q) = u.query() {
            let config = QS_CONFIG.get_or_init(|| QsConfig::new(32, false));

            match config.deserialize_str::<std::collections::HashMap<String, serde_json::Value>>(q)
            {
                Ok(map) => {
                    let mut obj = serde_json::Map::new();
                    for (k, v) in map {
                        obj.insert(k, v);
                    }
                    req.query_params = Some(serde_json::Value::Object(obj));
                }
                Err(e) => {
                    tracing::event!(
                        tracing::Level::TRACE,
                        operation = "url_parser_qs_error",
                        query = %q,
                        error = %e
                    );
                    return Self::reject_request(res, HttpStatusCode::BadRequest);
                }
            }
        }

        true
    }
}

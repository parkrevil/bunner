use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use cookie::Cookie;
use serde_json::json;

pub struct CookieParser;

impl Middleware for CookieParser {
    #[tracing::instrument(level = "trace", skip(self, req, _res, _payload))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        _payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation = "cookie_parser");
        if let Some(c) = req
            .headers
            .get("cookie")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
        {
            let map: std::collections::HashMap<String, String> = Cookie::split_parse(c.as_str())
                .filter_map(|c| c.ok())
                .map(|c| (c.name().to_string(), c.value().to_string()))
                .collect();

            req.cookies = json!(map);
        }

        true
    }
}

#[cfg(test)]
mod cookie_parser_test;
mod parser;
#[cfg(test)]
mod parser_test;

use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use parser::parse_cookie_header;
use serde_json::json;

use super::Middleware;

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

        if let Some(cookie_header) = req.headers.get("cookie") {
            let parsed = parse_cookie_header(cookie_header);
            req.cookies = json!(parsed);
        }

        true
    }
}

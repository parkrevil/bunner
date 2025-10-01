#[cfg(test)]
mod mod_test;
mod parser;
#[cfg(test)]
mod parser_test;

use crate::enums::HttpStatusCode;
use crate::structures::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use parser::ParsedUrl;
use parser::parse_url;

use super::Middleware;

pub struct UrlParser;

impl UrlParser {
    fn reject_request(res: &mut BunnerResponse, status: HttpStatusCode) -> bool {
        res.status = Some(status);
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
        tracing::event!(tracing::Level::TRACE, operation = "url_parser", url = %payload.url);

        let parsed = match parse_url(payload.url.as_str()) {
            Ok(p) => p,
            Err(_) => {
                tracing::event!(
                    tracing::Level::TRACE,
                    operation = "url_parser_reject",
                    reason = "url_parse_error"
                );
                return Self::reject_request(res, HttpStatusCode::BadRequest);
            }
        };

        let ParsedUrl {
            path,
            query,
            protocol,
            host,
            hostname,
            port,
        } = parsed;

        req.path = path;
        req.query_string = query;

        if req.protocol.is_none() {
            req.protocol = protocol;
        }
        if req.host.is_none() {
            req.host = host;
        }
        if req.hostname.is_none() {
            req.hostname = hostname;
        }
        if req.port.is_none() {
            req.port = port;
        }

        true
    }
}

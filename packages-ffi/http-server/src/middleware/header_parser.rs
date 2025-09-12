use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};

pub struct HeaderParser;

impl Middleware for HeaderParser {
    #[tracing::instrument(level = "trace", skip(self, req, _res, payload), fields(ct=payload.headers.get("content-type").map(|s| s.as_str()).unwrap_or("")))]
    fn handle(
        &self,
        req: &mut BunnerRequest,
        _res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        tracing::event!(tracing::Level::TRACE, operation = "header_parser");
        // keep as HashMap to avoid JSON conversion cost on hot path
        req.headers = payload.headers.clone();

        // content-type and charset
        if let Some(ct) = payload.headers.get("content-type") {
            let mut ct_main = ct.as_str();
            if let Some(sc_pos) = ct.find(';') {
                ct_main = &ct[..sc_pos];

                for param in ct[sc_pos + 1..].split(';') {
                    let mut kv = param.splitn(2, '=');
                    let k = kv
                        .next()
                        .map(|s| s.trim().to_ascii_lowercase())
                        .unwrap_or_default();
                    let v = kv.next().map(|s| s.trim().trim_matches('"')).unwrap_or("");

                    if k == "charset" {
                        req.charset = Some(v.to_string());
                    }
                }
            }

            req.content_type = Some(ct_main.trim().to_string());
        }

        if let Some(ct) = payload.headers.get("content-length") {
            req.content_length = Some(ct.parse::<u64>().unwrap_or(0));
        }

        true
    }
}

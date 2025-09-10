use crate::middleware::chain::Middleware;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestPayload};
use url::Url;

pub struct UrlParser;

impl Middleware for UrlParser {
    fn handle(
        &self,
        req: &mut BunnerRequest,
        res: &mut BunnerResponse,
        payload: &HandleRequestPayload,
    ) -> bool {
        // Parse URL; on failure respond 400 and stop chain
        let u = match Url::parse(payload.url.as_str()) {
            Ok(u) => u,
            Err(_) => {
                res.http_status = 400;
                res.body = serde_json::Value::String("Bad Request: invalid URL".to_string());
                return false;
            }
        };

        req.path = u.path().to_string();

        if let Some(q) = u.query() {
            match serde_qs::from_str::<serde_json::Value>(q) {
                Ok(v) => {
                    req.query_params = Some(v);
                }
                Err(_) => {
                    res.http_status = 400;
                    res.body =
                        serde_json::Value::String("Bad Request: invalid querystring".to_string());

                    return false;
                }
            }
        }

        true
    }
}

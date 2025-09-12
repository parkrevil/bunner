use std::os::raw::c_char;
use std::sync::Arc;

use crate::errors::HttpServerErrorCode;
use crate::middleware::body_parser::BodyParser;
use crate::middleware::chain::Chain;
use crate::middleware::cookie_parser::CookieParser;
use crate::middleware::header_parser::HeaderParser;
use crate::middleware::url_parser::UrlParser;
use crate::r#enum::HttpMethod;
use crate::router;
use crate::structure::{BunnerRequest, BunnerResponse, HandleRequestOutput, HandleRequestPayload};
use crate::helpers::callback_handle_request;
use crate::structure::HttpServerError;
use serde_json::Value as JsonValue;

#[inline]
fn parse_payload(payload_str: &str) -> Result<HandleRequestPayload, HttpServerErrorCode> {
    serde_json::from_str::<HandleRequestPayload>(payload_str)
        .map_err(|_| HttpServerErrorCode::InvalidJsonString)
}

pub fn process_job(
    cb: extern "C" fn(*const c_char, u16, *mut c_char),
    request_id_owned: String,
    payload_owned_for_job: String,
    ro: Arc<router::RouterReadOnly>,
) {
    let payload = match parse_payload(&payload_owned_for_job) {
        Ok(p) => p,
        Err(e) => {
            let bunner_error = HttpServerError::new(
                e.into(),
                format!("Error occurred: {:?}", e),
                Some(serde_json::json!({"operation": "parse_payload"}))
            );
            callback_handle_request(cb, Some(&request_id_owned), 0, &bunner_error);
            return;
        }
    };

    let http_method = match HttpMethod::from_u8(payload.http_method) {
        Ok(m) => m,
        Err(e) => {
            let bunner_error = HttpServerError::new(
                e.into(),
                format!("Error occurred: {:?}", e),
                Some(serde_json::json!({"operation": "http_method_parse"}))
            );
            callback_handle_request(cb, Some(&request_id_owned), 0, &bunner_error);
            return;
        }
    };

    let mut request = BunnerRequest {
        url: payload.url.clone(),
        http_method,
        path: String::new(),
        headers: serde_json::Value::Object(serde_json::Map::new()),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
        content_type: None,
        content_length: None,
        charset: None,
        params: None,
        query_params: None,
        body: None,
    };
    let mut response = BunnerResponse {
        http_status: crate::r#enum::HttpStatusCode::OK,
        headers: None,
        body: serde_json::Value::Null,
    };
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);

    // Execute middleware chain; if any middleware stops (returns false), callback immediately with current output
    if !chain.execute(&mut request, &mut response, &payload) {
        let output = HandleRequestOutput { request, response };
    callback_handle_request(cb, Some(&request_id_owned), 0, &output);
        return;
    }

    match ro.find(http_method, &request.path) {
        Some((route_key, params_vec)) => {
            // Build params JSON; use None when empty
            let params_json = if params_vec.is_empty() {
                None
            } else {
                Some(
                    serde_json::to_value(&params_vec)
                        .unwrap_or_else(|_| JsonValue::Object(serde_json::Map::new())),
                )
            };
            request.params = params_json;

            let output = HandleRequestOutput { request, response };

            callback_handle_request(
                cb,
                Some(&request_id_owned),
                route_key,
                &output,
            );
        }
        None => {
            let router_error = crate::router::RouterError {
                code: crate::router::RouterErrorCode::MatchNotFound,
                error: crate::router::RouterErrorCode::MatchNotFound.as_str().to_string(),
                description: "No matching route was found".to_string(),
                detail: Some(serde_json::json!({"operation": "find", "path": request.path, "method": http_method as u8})),
            };
            let be = HttpServerError::from(router_error);
            callback_handle_request(
                cb,
                Some(&request_id_owned),
                0,
                &be,
            );
        }
    }
}

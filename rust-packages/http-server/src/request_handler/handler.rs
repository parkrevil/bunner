use percent_encoding::percent_decode_str;
use serde_json::Value as JsonValue;
use std::{ffi::CStr, os::raw::c_char, sync::Arc};

use crate::enums::HttpMethod;
use crate::errors::{HttpServerError, HttpServerErrorCode};
use crate::middleware::{BodyParser, Chain, CookieParser, HeaderParser, UrlParser};
use crate::router;
use crate::utils::ffi::parse_json_pointer;

use super::structures::HandleRequestOutput;
use super::{
    callback_handle_request, BunnerRequest, BunnerResponse, HandleRequestCallback,
    HandleRequestPayload,
};

/// # Safety
/// - `request_id_ptr` must be a valid, non-null, null-terminated C string pointer until this
///   function has converted it to a Rust-owned `String`.
/// - `payload_ptr` must be a valid pointer to a 4-byte little-endian length-prefixed buffer
///   and remain valid for the duration of the call.
/// - The caller must ensure both pointers remain valid while this function executes.
#[tracing::instrument(skip(cb, payload_ptr, ro), fields(request_id=?request_id_ptr))]
pub unsafe fn handle(
    cb: HandleRequestCallback,
    request_id_ptr: *const c_char,
    payload_ptr: *const u8,
    ro: Arc<router::RouterReadOnly>,
) {
    // Convert request_id_ptr to &str for error messages and callbacks
    let request_id = match unsafe { CStr::from_ptr(request_id_ptr).to_str() } {
        Ok(s) => s.to_string(),
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidRequestId,
                "request_handler",
                "handle",
                "parsing",
                "Request id is not valid UTF-8".to_string(),
                Some(serde_json::json!({"requestIdPtr": format!("{:p}", request_id_ptr)})),
            );

            callback_handle_request(cb, None, None, &http_error);

            return;
        }
    };
    let payload = match unsafe { parse_json_pointer::<HandleRequestPayload>(payload_ptr) } {
        Ok(p) => p,
        Err(_) => {
            // We cannot easily construct a preview without reading the pointer here; keep error concise.
            let err = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "request_handler",
                "parse_payload",
                "parsing",
                "Failed to parse request payload JSON".to_string(),
                Some(serde_json::json!({"requestId": request_id})),
            );

            tracing::event!(tracing::Level::ERROR, reason="parse_payload_error", request_id=%request_id);

            callback_handle_request(cb, Some(request_id.as_str()), None, &err);

            return;
        }
    };
    let http_method = match HttpMethod::from_u8(payload.http_method) {
        Ok(m) => m,
        Err(e) => {
            let bunner_error = HttpServerError::new(
                e,
                "request_handler",
                "parse_payload",
                "validation",
                "Invalid HTTP method in request payload".to_string(),
                Some(
                    serde_json::json!({"requestId": request_id, "httpMethod": payload.http_method}),
                ),
            );

            callback_handle_request(cb, Some(request_id.as_str()), None, &bunner_error);

            return;
        }
    };
    let mut request = BunnerRequest {
        url: payload.url.clone(),
        http_method,
        path: String::new(),
        headers: payload.headers.clone(),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
        content_type: None,
        content_length: None,
        charset: None,
        params: None,
        query_params: None,
        body: None,
    };
    let mut response = BunnerResponse {
        http_status: crate::enums::HttpStatusCode::OK,
        headers: None,
        body: serde_json::Value::Null,
    };
    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);

    if !chain.execute(&mut request, &mut response, &payload) {
        let output = HandleRequestOutput { request, response };

        tracing::event!(tracing::Level::TRACE, step = "middleware_stopped", request_id=%request_id);

        callback_handle_request(cb, Some(request_id.as_str()), None, &output);

        return;
    }

    match ro.find(http_method, &request.path) {
        Ok((route_key, params_vec)) => {
            let params = if params_vec.is_empty() {
                None
            } else {
                let mut obj = serde_json::Map::new();

                for (k, (start, len)) in params_vec.iter() {
                    if *start + *len <= request.path.len() {
                        let raw = &request.path[*start..*start + *len];
                        let decoded = percent_decode_str(raw).decode_utf8_lossy().to_string();

                        obj.insert(k.clone(), JsonValue::String(decoded));
                    }
                }

                Some(JsonValue::Object(obj))
            };

            request.params = params;

            let output = HandleRequestOutput { request, response };

            tracing::event!(
                tracing::Level::TRACE,
                step = "route_match",
                route_key = route_key as u64,
                request_id=%request_id
            );

            callback_handle_request(cb, Some(request_id.as_str()), Some(route_key), &output);
        }
        Err(router_error) => {
            let mut be = HttpServerError::from(router_error);

            be.merge_extra(serde_json::json!({
                "operation": "handle_request_find",
                "requestId": request_id,
                "method": http_method as u8,
                "path": request.path
            }));

            tracing::event!(tracing::Level::TRACE, step = "route_not_found", request_id=%request_id);

            callback_handle_request(cb, Some(request_id.as_str()), None, &be);
        }
    }
}

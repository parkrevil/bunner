use std::ffi::CString;
use std::os::raw::c_char;
use std::sync::Arc;

use crate::errors::HttpServerError;
use crate::r#enum::HttpMethod;
use crate::middleware::chain::Chain;
use crate::middleware::header_parser::HeaderParser;
use crate::middleware::url_parser::UrlParser;
use crate::middleware::cookie_parser::CookieParser;
use crate::middleware::body_parser::BodyParser;
use crate::router;
use crate::structure::{HandleRequestPayload, BunnerRequest, BunnerResponse, HandleRequestOutput};
use crate::util::{make_ffi_error_result, make_ffi_result};
use serde_json::Value as JsonValue;


#[inline]
fn callback_with_request_id_ptr(
    cb: extern "C" fn(*const c_char, u16, *mut c_char),
    request_id: &str,
    route_key: u16,
    result_ptr: *mut c_char,
) {
    let request_id_c = CString::new(request_id).unwrap();
    cb(request_id_c.as_ptr(), route_key, result_ptr);
    std::mem::forget(request_id_c);
}

#[inline]
fn parse_payload(payload_str: &str) -> Result<HandleRequestPayload, HttpServerError> {
    serde_json::from_str::<HandleRequestPayload>(payload_str)
        .map_err(|_| HttpServerError::InvalidJsonString)
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
            callback_with_request_id_ptr(cb, &request_id_owned, 0, make_ffi_error_result(e, None));
            return;
        }
    };

    let http_method = match HttpMethod::from_u8(payload.http_method) {
      Ok(m) => m,
      Err(e) => {
          callback_with_request_id_ptr(cb, &request_id_owned, 0, make_ffi_error_result(e, None));
          return;
      }
    };

    let mut request = BunnerRequest {
        url: payload.url.clone(),
        http_method,
        host: String::new(),
        hostname: String::new(),
        port: None,
        path: String::new(),
        params: None,
        query_params: None,
        body: None,
        ip: String::new(),
        ip_version: 0,
        http_protocol: String::new(),
        http_version: String::new(),
        headers: serde_json::Value::Object(serde_json::Map::new()),
        cookies: serde_json::Value::Object(serde_json::Map::new()),
        content_type: String::new(),
        charset: String::new(),
    };
    let mut response = BunnerResponse { http_status: 200, headers: None, body: serde_json::Value::Null };

    let chain = Chain::new()
        .with(HeaderParser)
        .with(UrlParser)
        .with(CookieParser)
        .with(BodyParser);

    // Execute middleware chain; if any middleware stops (returns false), callback immediately with current output
    if !chain.execute(&mut request, &mut response, &payload) {
        let output = HandleRequestOutput { request, response };
        callback_with_request_id_ptr(cb, &request_id_owned, 0, make_ffi_result(&output));
        return;
    }

    match ro.find(http_method, &request.path) {
        Some((route_key, params_vec)) => {
            // Build params JSON; use None when empty
            let params_json = if params_vec.is_empty() {
                None
            } else {
                Some(serde_json::to_value(&params_vec).unwrap_or_else(|_| JsonValue::Object(serde_json::Map::new())))
            };
            request.params = params_json;

            let output = HandleRequestOutput { request, response };

            callback_with_request_id_ptr(cb, &request_id_owned, route_key, make_ffi_result(&output));
        }
        None => {
            callback_with_request_id_ptr(
                cb,
                &request_id_owned,
                0,
                make_ffi_error_result(crate::router::RouterError::MatchNotFound, None),
            );
        }
    }
}

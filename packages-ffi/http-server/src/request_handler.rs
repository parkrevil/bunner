use std::collections::HashMap;
use std::ffi::CString;
use std::os::raw::c_char;
use std::sync::Arc;

use cookie::Cookie;
use url::Url;

use crate::errors::HttpServerError;
use crate::r#enum::HttpMethod;
use crate::router;
use crate::structure::{HandleRequestPayload, HandleRequestResult};
use crate::util::{make_ffi_error_result, make_ffi_result};
use serde_json::Value as JsonValue;

type ParsedUrlBody = (
    String,              // path
    Option<JsonValue>,   // query_params
    Option<JsonValue>,   // body_json
    String,              // ip
    u8,                  // ip_version
    String,              // http_protocol
    String,              // http_version
    JsonValue,           // headers_json
    JsonValue,           // cookies_json
);

#[inline]
fn callback_with_request_id_ptr(
    cb: extern "C" fn(*const c_char, *mut c_char),
    request_id: &str,
    result_ptr: *mut c_char,
) {
    let request_id_c = CString::new(request_id).unwrap();
    cb(request_id_c.as_ptr(), result_ptr);
    std::mem::forget(request_id_c);
}

#[inline]
fn parse_payload(payload_str: &str) -> Result<HandleRequestPayload, HttpServerError> {
    serde_json::from_str::<HandleRequestPayload>(payload_str)
        .map_err(|_| HttpServerError::InvalidJsonString)
}

#[inline]
fn parse_url_and_body(payload: &HandleRequestPayload) -> Result<ParsedUrlBody, HttpServerError> {
    let parsed_url = Url::parse(payload.url.as_str()).map_err(|_| HttpServerError::InvalidUrl)?;

    let path = parsed_url.path().to_string();
    let raw_query = parsed_url.query().map(|s| s.to_string());
    let query_params: Option<JsonValue> = match raw_query {
        Some(q) => match serde_qs::from_str::<JsonValue>(&q) {
            Ok(v) => Some(v),
            Err(_) => return Err(HttpServerError::InvalidQueryString),
        },
        None => None,
    };

    let _cookies: Option<HashMap<String, String>> = payload.headers.get("cookie").map(|cookie_header| {
        Cookie::split_parse(cookie_header)
            .filter_map(|c| c.ok())
            .map(|c| (c.name().to_string(), c.value().to_string()))
            .collect::<HashMap<_, _>>()
    });
    let cookies_json: JsonValue = match &_cookies {
        Some(m) => serde_json::to_value(m).unwrap_or(JsonValue::Object(serde_json::Map::new())),
        None => JsonValue::Object(serde_json::Map::new()),
    };

    let protocol = payload
        .headers
        .get("x-forwarded-proto")
        .or_else(|| payload.headers.get("x-forwarded-protocol"))
        .cloned()
        .unwrap_or_else(|| parsed_url.scheme().to_string());
    let mut ip = payload
        .headers
        .get("x-forwarded-for")
        .and_then(|v| v.split(',').next().map(|s| s.trim().to_string()))
        .or_else(|| payload.headers.get("x-real-ip").cloned())
        .unwrap_or_default();

    if ip.is_empty() && let Some(h) = parsed_url.host_str() {
        if h.eq_ignore_ascii_case("localhost") {
            ip = "127.0.0.1".to_string();
        } else if h.parse::<std::net::Ipv4Addr>().is_ok() || h.parse::<std::net::Ipv6Addr>().is_ok() {
            ip = h.to_string();
        }
    }

    let ip_version: u8 = if ip.contains(':') { 6 } else { 4 };

    let http_protocol = protocol.clone();
    let http_version = payload
        .headers
        .get("x-http-version")
        .cloned()
        .unwrap_or_else(|| "1.1".to_string());

    let body_json: Option<JsonValue> = match payload.body {
        Some(ref s) => serde_json::from_str::<JsonValue>(s).ok(),
        None => None,
    };

    let headers_json: JsonValue = serde_json::to_value(&payload.headers)
        .unwrap_or(JsonValue::Object(serde_json::Map::new()));

    Ok((
        path,
        query_params,
        body_json,
        ip,
        ip_version,
        http_protocol,
        http_version,
        headers_json,
        cookies_json,
    ))
}

#[inline]
fn build_handle_result(
    route_key: u16,
    params_vec: Vec<(String, String)>,
    query_params: Option<JsonValue>,
    body_json: Option<JsonValue>,
) -> HandleRequestResult {
    let mut map = serde_json::Map::new();
    for (n, v) in params_vec.into_iter() {
        map.insert(n, JsonValue::String(v));
    }
    let params_json = JsonValue::Object(map);

    HandleRequestResult {
        route_key,
        params: if params_json
            .as_object()
            .map(|m| m.is_empty())
            .unwrap_or(true)
        {
            None
        } else {
            Some(params_json)
        },
        query_params,
        body: body_json,
        ip: String::new(),
        ip_version: 4,
        http_protocol: String::new(),
        http_version: String::from("1.1"),
        headers: JsonValue::Object(serde_json::Map::new()),
        cookies: JsonValue::Object(serde_json::Map::new()),
        content_type: String::new(),
        charset: String::new(),
        response: None,
    }
}

pub fn process_job(
    cb: extern "C" fn(*const c_char, *mut c_char),
    request_id_owned: String,
    payload_owned_for_job: String,
    ro: Arc<router::RouterReadOnly>,
) {
    let payload = match parse_payload(&payload_owned_for_job) {
        Ok(p) => p,
        Err(e) => {
            callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_error_result(e, None));
            return;
        }
    };

    let (path, query_params, body_json, ip, ip_version, http_protocol, http_version, headers_json, cookies_json) = match parse_url_and_body(&payload) {
        Ok(v) => v,
        Err(e) => {
            callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_error_result(e, None));
            return;
        }
    };

    let http_method = match HttpMethod::from_u8(payload.http_method) {
        Ok(m) => m,
        Err(e) => {
            callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_error_result(e, None));
            return;
        }
    };

    let ok = match ro.find(http_method, &path) {
        Some((route_key, params_vec)) => {
            let mut result = build_handle_result(route_key, params_vec, query_params, body_json);
            result.ip = ip;
            result.ip_version = ip_version;
            result.http_protocol = http_protocol;
            result.http_version = http_version;
            result.headers = headers_json;
            result.cookies = cookies_json;
            // Content-Type & charset
            if let Some(ct) = payload.headers.get("content-type") {
                result.content_type = ct.clone();
                let lower = ct.to_lowercase();
                if let Some(pos) = lower.find("charset=") {
                    result.charset = lower[pos + 8..].trim().to_string();
                }
            }
            result
        },
        None => {
            callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_error_result(crate::router::RouterError::MatchNotFound, None));
            return;
        }
    };

    callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_result(&ok));
}



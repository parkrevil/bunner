pub mod r#enum;
pub mod errors;
pub mod router;
pub mod structure;
pub mod util;

use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
};

use crate::errors::HttpServerError;
mod thread_pool;
use crate::structure::{AddRouteResult, FfiError, HandleRequestPayload, HandleRequestResult};
use crate::util::make_ffi_error_result;
use crate::{
    r#enum::HttpMethod,
    util::{make_ffi_result, serialize_to_cstring},
};
use thread_pool::submit_job;
use url::Url;
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use cookie::Cookie;
use serde_qs;

pub type HttpServerHandle = *mut HttpServer;
pub struct RouterPtr(*mut router::Router);

#[repr(C)]
pub struct HttpServer {
    router: RouterPtr,
}

#[inline(always)]
fn callback_with_request_id_ptr(
    cb: extern "C" fn(*const c_char, *mut c_char),
    request_id: &str,
    result_ptr: *mut c_char,
) {
    let request_id_c = CString::new(request_id).unwrap();
    cb(request_id_c.as_ptr(), result_ptr);
    std::mem::forget(request_id_c);
}

#[unsafe(no_mangle)]
pub extern "C" fn init() -> HttpServerHandle {
    let router = Box::into_raw(Box::new(router::Router::new(None)));
    let server = Box::new(HttpServer {
        router: RouterPtr(router),
    });

    Box::into_raw(server)
}

/// Destroys the HttpServer instance and frees all associated memory.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
/// After calling this function, the handle is dangling and must not be used again.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy(handle: HttpServerHandle) {
    let http_server = unsafe { Box::from_raw(handle) };

    if !http_server.router.0.is_null() {
        let _ = unsafe { Box::from_raw(http_server.router.0) };
    }

    drop(http_server);
}

/// Adds a new route to the router.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `path` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn add_route(
    handle: HttpServerHandle,
    http_method: u8,
    path: *const c_char,
) -> *mut c_char {
    if handle.is_null() {
        return make_ffi_error_result(HttpServerError::HandleIsNull, None);
    }

    let http_method = match HttpMethod::from_u8(http_method) {
        Ok(m) => m,
        Err(e) => return make_ffi_error_result(e, None),
    };
    let http_server = unsafe { &*handle };
    let router_mut = unsafe { &mut *http_server.router.0 };
    let path_str = unsafe { CStr::from_ptr(path) }.to_string_lossy();

    match router_mut.add(http_method, &path_str) {
        Ok(k) => {
            let result = AddRouteResult { key: k };

            make_ffi_result(&result)
        }
        Err(e) => make_ffi_error_result(e, None),
    }
}

/// Adds multiple routes to the router from a JSON-encoded pointer.
///
/// # Safety
/// - `handle` must be a valid pointer returned by `init`.
/// - `routes_ptr` must be a valid, null-terminated C string that remains valid for the
///   duration of this call. This function does not take ownership of the input buffer.
/// - The returned pointer is allocated by Rust and must be freed by calling `free_string`.
/// - Passing invalid pointers or non-UTF8 data is undefined behavior.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn add_routes(
    handle: HttpServerHandle,
    routes_ptr: *const c_char,
) -> *mut c_char {
    if handle.is_null() {
        return make_ffi_error_result(HttpServerError::HandleIsNull, None);
    }

    let routes_str = match unsafe { CStr::from_ptr(routes_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            return make_ffi_error_result(HttpServerError::InvalidJsonString, None);
        }
    };

    let routes: Vec<(HttpMethod, String)> =
        match serde_json::from_str::<Vec<(HttpMethod, String)>>(routes_str) {
            Ok(r) => r,
            Err(e) => {
                let msg = e.to_string();

                if msg.contains("InvalidHttpMethod") {
                    return make_ffi_error_result(HttpServerError::InvalidHttpMethod, None);
                } else {
                    return make_ffi_error_result(HttpServerError::InvalidJsonString, None);
                }
            }
        };

    let http_server = unsafe { &*handle };
    let router_mut = unsafe { &mut *http_server.router.0 };

    match router_mut.add_bulk(routes) {
        Ok(r) => make_ffi_result(r),
        Err(e) => make_ffi_error_result(e, None),
    }
}

/// Finds a route that matches the given method and path from a serialized JSON request.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `request_json` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn handle_request(
    handle: HttpServerHandle,
    request_id_ptr: *const c_char,
    paylaod_ptr: *const c_char,
    cb: extern "C" fn(*const c_char, *mut c_char),
) {
    if handle.is_null() {
        cb(
            request_id_ptr,
            make_ffi_error_result(HttpServerError::HandleIsNull, None),
        );

        return;
    }

    let request_id_str = match unsafe { CStr::from_ptr(request_id_ptr).to_str() } {
        Ok(s) => s,
        Err(e) => {
            cb(
                CString::new("").unwrap().as_ptr(),
                make_ffi_error_result(HttpServerError::InvalidRequestId, None),
            );

            return;
        }
    };

    let payload_str = match unsafe { CStr::from_ptr(paylaod_ptr).to_str() } {
        Ok(s) => s,
        Err(e) => {
            cb(
                request_id_ptr,
                make_ffi_error_result(HttpServerError::InvalidJsonString, None),
            );

            return;
        }
    };

    let payload: HandleRequestPayload = match serde_json::from_str(payload_str) {
        Ok(p) => p,
        Err(e) => {
            cb(
                request_id_ptr,
                make_ffi_error_result(HttpServerError::InvalidJsonString, None),
            );

            return;
        }
    };

    // Own the request_id for async job
    let request_id_owned = request_id_str.to_owned();
    let router_ptr = (*handle).router.0;
    let method_u8 = payload.http_method;
    let url_str = payload.url.clone();
    let headers = payload.headers.clone();
    let body_str = payload.body.clone();

    submit_job(Box::new(move || {
        // Parse URL
        let parsed_url = match Url::parse(&url_str) {
            Ok(u) => u,
            Err(_) => {
                callback_with_request_id_ptr(
                    cb,
                    &request_id_owned,
                    make_ffi_error_result(HttpServerError::InvalidUrl, None),
                );
                return;
            }
        };

        let path = parsed_url.path().to_string();
        let raw_query = parsed_url.query().map(|s| s.to_string());

        // Query params via serde_qs
        let query_params: Option<JsonValue> = match raw_query {
            Some(q) => match serde_qs::from_str::<JsonValue>(&q) {
                Ok(v) => Some(v),
                Err(_) => {
                    callback_with_request_id_ptr(
                        cb,
                        &request_id_owned,
                        make_ffi_error_result(HttpServerError::InvalidQueryString, None),
                    );
                    return;
                }
            },
            None => None,
        };

        // Cookies (not returned in result yet, parsed for future use)
        let _cookies: Option<HashMap<String, String>> = headers
            .get("cookie")
            .map(|cookie_header| {
                Cookie::split_parse(cookie_header)
                    .filter_map(|c| c.ok())
                    .map(|c| (c.name().to_string(), c.value().to_string()))
                    .collect::<HashMap<_, _>>()
            });

        // Protocol/IP derivation (not returned yet)
        let _protocol = headers
            .get("x-forwarded-proto")
            .or_else(|| headers.get("x-forwarded-protocol"))
            .cloned()
            .unwrap_or_else(|| "http".to_string());
        let _ip = headers
            .get("x-forwarded-for")
            .and_then(|v| v.split(',').next().map(|s| s.trim().to_string()))
            .or_else(|| headers.get("x-real-ip").cloned());

        // Body JSON (optional)
        let body_json: Option<JsonValue> = match body_str {
            Some(s) => match serde_json::from_str::<JsonValue>(&s) {
                Ok(v) => Some(v),
                Err(_) => None,
            },
            None => None,
        };

        // Method
        let method = match HttpMethod::from_u8(method_u8) {
            Ok(m) => m,
            Err(e) => {
                callback_with_request_id_ptr(
                  cb, &request_id_owned, make_ffi_error_result(e, None)
                );
                return;
            }
        };

        // Route match (read-only)
        let (route_key, param_pairs) = unsafe { &*router_ptr }.find(method, &path).map_err(|e| e).map(|t| t);
        let (route_key, params_json) = match (route_key, param_pairs) {
            (k, pairs) => {
                let mut map = serde_json::Map::new();
                for (name, value) in pairs {
                    map.insert(name, JsonValue::String(value));
                }
                (k, JsonValue::Object(map))
            }
        };

        let ok = HandleRequestResult {
            route_key,
            params: if params_json.as_object().map(|m| m.is_empty()).unwrap_or(true) { None } else { Some(params_json) },
            query_params,
            body: body_json,
            response: None,
        };

        callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_result(&ok));
    }));
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn router_seal(handle: HttpServerHandle) {
    let http_server = unsafe { &*handle };

    unsafe { &mut *http_server.router.0 }.finalize()
}

/// Frees the memory for a C string that was allocated by Rust.
///
/// # Safety
/// The `ptr` must be a non-null pointer returned by a Rust function from this crate
/// (e.g., `router_add` or `handle_request`).
/// After calling this function, the pointer is dangling and must not be used again.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn free_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe {
            let _ = CString::from_raw(ptr);
        }
    }
}

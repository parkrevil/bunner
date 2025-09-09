pub mod r#enum;
pub mod errors;
pub mod router;
pub mod structure;
pub mod util;

use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
    sync::Arc,
};

use crate::errors::HttpServerError;
mod thread_pool;
use crate::structure::{AddRouteResult, HandleRequestPayload, HandleRequestResult};
use crate::util::make_ffi_error_result;
use crate::{r#enum::HttpMethod, util::make_ffi_result};
use cookie::Cookie;
use serde_json::Value as JsonValue;
use serde_qs;
use std::collections::HashMap;
use thread_pool::submit_job;
use url::Url;

pub type HttpServerHandle = *mut HttpServer;

#[repr(C)]
pub struct HttpServer {
    router: Arc<parking_lot::RwLock<router::Router>>,
    readonly: Arc<parking_lot::RwLock<Option<router::RouterReadOnly>>>,
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
    let server = Box::new(HttpServer {
        router: Arc::new(parking_lot::RwLock::new(router::Router::new(None))),
        readonly: Arc::new(parking_lot::RwLock::new(None)),
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
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
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
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;

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
        Err(_) => {
            cb(
                CString::new("").unwrap().as_ptr(),
                make_ffi_error_result(HttpServerError::InvalidRequestId, None),
            );

            return;
        }
    };

    let payload_str = match unsafe { CStr::from_ptr(paylaod_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            cb(
                request_id_ptr,
                make_ffi_error_result(HttpServerError::InvalidJsonString, None),
            );

            return;
        }
    };

    let payload: HandleRequestPayload = match serde_json::from_str(payload_str) {
        Ok(p) => p,
        Err(_) => {
            cb(
                request_id_ptr,
                make_ffi_error_result(HttpServerError::InvalidJsonString, None),
            );

            return;
        }
    };

    // Own the request_id for async job
    let request_id_owned = request_id_str.to_owned();
    // Parse URL
    let parsed_url = match Url::parse(payload.url.as_str()) {
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
    let headers = payload.headers; // take ownership
    let _cookies: Option<HashMap<String, String>> = headers.get("cookie").map(|cookie_header| {
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
    let body_json: Option<JsonValue> = match payload.body {
        Some(ref s) => match serde_json::from_str::<JsonValue>(s) {
            Ok(v) => Some(v),
            Err(_) => None,
        },
        None => None,
    };

    // Method
    let method = match HttpMethod::from_u8(payload.http_method) {
        Ok(m) => m,
        Err(e) => {
            callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_error_result(e, None));
            return;
        }
    };

    // Route match (read-only) on current thread
    let http_server = &*handle;
    // Prefer read-only struct if available (lock-free for static paths)
    let ro_guard = http_server.readonly.read();
    let find_result = if let Some(ref ro) = *ro_guard {
        match ro.find_static(method, &path) {
            Some(k) => Ok((k, Vec::new())),
            None => {
                drop(ro_guard);
                let guard = http_server.router.read();
                guard.find(method, &path)
            }
        }
    } else {
        drop(ro_guard);
        let guard = http_server.router.read();
        guard.find(method, &path)
    };
    let ok = match find_result {
        Ok((route_key, param_pairs)) => {
            let mut map = serde_json::Map::new();
            for (name, value) in param_pairs {
                map.insert(name, JsonValue::String(value));
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
                response: None,
            }
        }
        Err(e @ crate::router::RouterError::MatchNotFound)
        | Err(e @ crate::router::RouterError::MatchPathEmpty)
        | Err(e @ crate::router::RouterError::MatchPathNotAscii)
        | Err(e @ crate::router::RouterError::MatchPathContainsDisallowedCharacters) => {
            callback_with_request_id_ptr(cb, &request_id_owned, make_ffi_error_result(e, None));
            return;
        }
        Err(e) => {
            callback_with_request_id_ptr(
                cb,
                &request_id_owned,
                make_ffi_error_result(HttpServerError::ServerError, Some(format!("{:?}", e))),
            );
            return;
        }
    };

    // Dispatch only the callback off-thread (no Router captured)
    let request_id_for_cb = request_id_owned.clone();
    match submit_job(Box::new(move || {
        callback_with_request_id_ptr(cb, &request_id_for_cb, make_ffi_result(&ok));
    })) {
        Ok(()) => {}
        Err(_e) => {
            callback_with_request_id_ptr(
                cb,
                &request_id_owned,
                make_ffi_error_result(HttpServerError::ServerError, Some("QueueFull".to_string())),
            );
        }
    }
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn router_seal(handle: HttpServerHandle) {
    let http_server = unsafe { &*handle };
    {
        let mut guard = http_server.router.write();
        guard.finalize();
        // Build read-only after finalize
        let ro = guard.build_readonly();
        let mut s = http_server.readonly.write();
        *s = Some(ro);
    }
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

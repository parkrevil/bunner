pub mod r#enum;
pub mod errors;
pub mod router;
pub mod structure;
pub mod util;
mod request_handler;

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
use serde_json::Value as JsonValue;
// serde_qs used via fully-qualified paths
use thread_pool::shutdown_pool;
use thread_pool::submit_job;
use url::Url;

pub type HttpServerHandle = *mut HttpServer;

#[repr(C)]
pub struct HttpServer {
    router: parking_lot::RwLock<router::Router>,
    readonly: Arc<parking_lot::RwLock<Option<Arc<router::RouterReadOnly>>>>,
}

// ---- Internal helpers (SRP) ----

#[inline]
#[allow(dead_code)]
fn parse_payload(payload_str: &str) -> Result<HandleRequestPayload, HttpServerError> {
    serde_json::from_str::<HandleRequestPayload>(payload_str)
        .map_err(|_| HttpServerError::InvalidJsonString)
}

#[inline]
#[allow(dead_code)]
fn parse_url_and_body(payload: &HandleRequestPayload) -> Result<(String, Option<JsonValue>, Option<JsonValue>), HttpServerError> {
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

    let body_json: Option<JsonValue> = match payload.body {
        Some(ref s) => serde_json::from_str::<JsonValue>(s).ok(),
        None => None,
    };

    Ok((path, query_params, body_json))
}

#[inline]
#[allow(dead_code)]
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

#[inline(always)]
fn callback_handle_request(
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
        router: parking_lot::RwLock::new(router::Router::new(None)),
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
    // Ensure global worker pool is shutdown on destroy as per requirement
    shutdown_pool();
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
    if http_server.readonly.read().as_ref().is_some() {
        return make_ffi_error_result(crate::router::RouterError::RouterSealedCannotInsert, None);
    }
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
    if http_server.readonly.read().as_ref().is_some() {
        return make_ffi_error_result(crate::router::RouterError::RouterSealedCannotInsert, None);
    }
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
        callback_handle_request(
            cb,
            "",
            make_ffi_error_result(HttpServerError::HandleIsNull, None),
        );

        return;
    }

    let request_id_str = match unsafe { CStr::from_ptr(request_id_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            callback_handle_request(
                cb,
                "",
                make_ffi_error_result(HttpServerError::InvalidRequestId, None),
            );

            return;
        }
    };

    let payload_str = match unsafe { CStr::from_ptr(paylaod_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            callback_handle_request(
                cb,
                request_id_str,
                make_ffi_error_result(HttpServerError::InvalidJsonString, None),
            );

            return;
        }
    };

    let payload_owned: String = payload_str.to_owned();
    let http_server = unsafe { &*handle };
    let ro_opt = {
        let ro_guard = http_server.readonly.read();

        ro_guard.as_ref().map(Arc::clone)
    };

    if ro_opt.is_none() {
        callback_handle_request(
            cb,
            request_id_str,
            make_ffi_error_result(HttpServerError::RouteNotSealed, None),
        );
        return;
    }

    let request_id_owned = request_id_str.to_owned();
    let ro = ro_opt.unwrap();
    let payload_owned_for_job = payload_owned;

    match submit_job(Box::new(move || {
        request_handler::process_job(cb, request_id_owned, payload_owned_for_job, ro);
    })) {
        Ok(()) => {}
        Err(_e) => {
            callback_handle_request(
                cb,
                request_id_str,
                make_ffi_error_result(HttpServerError::QueueFull, None),
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
        {
            let mut s = http_server.readonly.write();
            *s = Some(Arc::new(ro));
        }
        // Drop the builder router by replacing with a minimal empty sealed router
        *guard = router::Router::new(None);
        guard.finalize();
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

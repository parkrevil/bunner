#![deny(
    clippy::dbg_macro,
    clippy::todo,
    clippy::unimplemented,
    clippy::panic,
    clippy::print_stdout,
    clippy::print_stderr
)]
#![deny(unsafe_op_in_unsafe_fn)]
pub mod app;
pub mod app_registry;
pub mod constants;
pub mod enums;
pub mod errors;
pub mod helpers;
pub mod middleware;
pub mod pointer_registry;
pub mod request_callback_dispatcher;
pub mod router;
pub mod structures;
mod thread_pool;
pub mod types;
pub mod utils;

#[cfg(test)]
#[path = "../tests/utils/mod.rs"]
pub mod test_utils;

#[cfg(test)]
mod pointer_registry_test;

use std::io;
use std::{ffi::CStr, os::raw::c_char};
use tracing_subscriber::{EnvFilter, fmt};

use crate::app_registry::{find_app, register_app, unregister_app};
use crate::constants::PAYLOAD_ZERO_COPY_THRESHOLD;
use crate::enums::{HttpMethod, LenPrefixedString};
use crate::errors::{HttpServerError, HttpServerErrorCode};
use crate::helpers::callback_handle_request;
use crate::structures::AddRouteResult;
use crate::thread_pool::shutdown_pool;
use crate::types::HandleRequestCallback;
use crate::types::{AppId, RequestKey};
use crate::utils::{
  ffi::{
    make_result, take_len_prefixed_pointer,
},
  json::deserialize,
};

#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "construct"))]
pub extern "C" fn construct() -> AppId {
    let subscriber = fmt()
        .with_env_filter(EnvFilter::new("trace"))
        .with_writer(io::stderr)
        .with_ansi(false)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Failed to set global logger");

    tracing::info!("Bunner Rust Http Server initialized.");

    register_app(Box::default())
}

/// Destroys the HttpServer instance and frees all associated memory.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
/// After calling this function, the handle is dangling and must not be used again.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation="destroy", app_id=?app_id))]
pub unsafe extern "C" fn destroy(app_id: AppId) {
    tracing::event!(tracing::Level::INFO, "App destroy called");

    if let Some(ptr) = unregister_app(app_id) {
        let app = unsafe { Box::from_raw(ptr) };

        drop(app);
    }

    shutdown_pool();
}

/// Adds a new route to the router.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `path` pointer must point to a valid, null-terminated C string.
/// - The returned pointer is a length-prefixed buffer allocated by Rust and must be freed
///   by calling `free_buffer`.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation="add_route", http_method=http_method))]
pub unsafe extern "C" fn add_route(
    app_id: AppId,
    http_method: u8,
    path_ptr: *const c_char,
) -> *mut u8 {
    let app_ptr = match find_app(app_id) {
        Some(p) => p,
        None => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::AppNotFound,
                "ffi",
                "add_route",
                "validation",
                "App not found. please check if the app is constructed".to_string(),
                Some(serde_json::json!(null)),
            );

            return make_result(&http_error);
        }
    };

    if path_ptr.is_null() {
        let err = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "ffi",
            "add_route",
            "validation",
            "Path pointer is null".to_string(),
            Some(serde_json::json!({
                "httpMethod": http_method
            })),
        );

        return make_result(&err);
    }

    let http_method = match HttpMethod::from_u8(http_method) {
        Ok(m) => m,
        Err(e) => {
            let err = HttpServerError::new(
                e,
                "ffi",
                "add_route",
                "validation",
                "Invalid httpMethod value when adding route".to_string(),
                Some(serde_json::json!({
                    "httpMethod": http_method,
                    "pathPtr": format!("{:p}", path_ptr)
                })),
            );

            return make_result(&err);
        }
    };
    let app = unsafe { &*app_ptr };
    let path_str = unsafe { CStr::from_ptr(path_ptr) }.to_string_lossy();

    match app.add_route(http_method, &path_str) {
        Ok(k) => make_result(&AddRouteResult { key: k }),
        Err(e) => make_result(&HttpServerError::from(e)),
    }
}

/// Adds multiple routes to the router from a length-prefixed JSON buffer pointer.
///
/// # Safety
/// - `handle` must be a valid pointer returned by `init`.
/// - `routes_ptr` must be a valid pointer to a 4-byte little-endian length-prefixed
///   buffer (4-byte LE length header followed by UTF-8 JSON payload). The function does
///   not take ownership of the input buffer; the caller is responsible for its lifetime
///   during this call.
/// - The returned pointer is a length-prefixed buffer allocated by Rust and must be freed
///   by calling `free_buffer`.
/// - Passing invalid pointers or non-UTF8 data is undefined behavior.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "add_routes"))]
pub unsafe extern "C" fn add_routes(handle: AppId, routes_ptr: *const u8) -> *mut u8 {
    let app_ptr = match find_app(handle) {
        Some(p) => p,
        None => {
            let err = HttpServerError::new(
                HttpServerErrorCode::AppNotFound,
                "ffi",
                "add_routes",
                "validation",
                "App not found. please check if the app is constructed".to_string(),
                Some(serde_json::json!(null)),
            );

            return make_result(&err);
        }
    };
    let routes_str: LenPrefixedString = match unsafe { take_len_prefixed_pointer(routes_ptr, PAYLOAD_ZERO_COPY_THRESHOLD as usize) } {
        Ok(p) => p,
        Err(e) => {
            let err = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "ffi",
                "add_routes",
                "validation",
                e.to_string(),
                None,
            );

            tracing::event!(tracing::Level::ERROR, reason="take_len_prefixed_pointer_error", routes_ptr=%format!("{:p}", routes_ptr));

            return make_result(&err);
        }
    };
    let routes_str_ref = match &routes_str {
        LenPrefixedString::Text(s) => s.as_str(),
        LenPrefixedString::Bytes(b) => unsafe { std::str::from_utf8_unchecked(b) },
    };
    let routes = match deserialize::<Vec<(HttpMethod, String)>>(routes_str_ref) {
        Ok(p) => p,
        Err(_) => {
            let err = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "app",
                "process_request",
                "parsing",
                "Failed to deserialize request payload JSON".to_string(),
                None,
            );

            tracing::event!(tracing::Level::ERROR, reason="deserialize_routes_error");

            return make_result(&err);
        }
    };
    let app = unsafe { &*app_ptr };
    let routes_len = routes.len();

    match app.add_routes(routes) {
        Ok(r) => {
            let cnt = r.len();

            tracing::event!(tracing::Level::DEBUG, count = cnt as u64, "routes added");

            make_result(&r)
        }
        Err(e) => {
            tracing::event!(tracing::Level::ERROR, code=?e.code, count=routes_len, "add_routes error");

            make_result(&HttpServerError::from(e))
        }
    }
}

/// Finds a route that matches the given method and path from a serialized JSON request.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `request_json` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "handle_request"))]
pub unsafe extern "C" fn handle_request(
    handle: AppId,
    request_key: RequestKey,
    payload_ptr: *const u8,
    cb: HandleRequestCallback,
) {
    let app = match find_app(handle) {
        Some(app_ptr) => unsafe { &*app_ptr },
        None => {
            let err = HttpServerError::new(
                HttpServerErrorCode::AppNotFound,
                "ffi",
                "handle_request",
                "system",
                "App not found. please check if the app is constructed".to_string(),
                Some(serde_json::json!(null)),
            );

            callback_handle_request(cb, request_key, None, &err);

            return;
        }
    };
    let payload_str: LenPrefixedString = match unsafe { take_len_prefixed_pointer(payload_ptr, PAYLOAD_ZERO_COPY_THRESHOLD as usize) } {
        Ok(p) => p,
        Err(e) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "ffi",
                "handle_request",
                "validation",
                e.to_string(),
                Some(serde_json::json!({"payload_ptr": format!("{:p}", payload_ptr)})),
            );

            callback_handle_request(cb, request_key, None, &http_error);

            return;
        }
    };

    app.handle_request(cb, request_key, payload_str);
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "seal_routes"))]
pub unsafe extern "C" fn seal_routes(handle: AppId) -> *mut u8 {
    let app_ptr = match find_app(handle) {
        Some(p) => p,
        None => {
            let err = HttpServerError::new(
                HttpServerErrorCode::AppNotFound,
                "ffi",
                "seal_routes",
                "system",
                "App not found. please check if the app is constructed".to_string(),
                Some(serde_json::json!(null)),
            );

            return make_result(&err);
        }
    };
    let app = unsafe { &*app_ptr };

    app.seal_routes();

    tracing::event!(tracing::Level::INFO, "routes sealed");

    make_result(&serde_json::json!({"result": true}))
}

/// Frees a raw buffer previously returned by `serialize_and_to_len_prefixed_buffer`.
///
/// # Safety
/// - `ptr` must be a pointer previously returned by a Rust function in this crate
///   that registered the buffer via `pointer_registry::register_raw_vec_and_into_raw`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn free(handle: AppId, ptr: *mut u8) {
    if find_app(handle).is_none() {
        return;
    }

    unsafe { pointer_registry::free(ptr) };
}

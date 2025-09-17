#![deny(
    clippy::dbg_macro,
    clippy::todo,
    clippy::unimplemented,
    clippy::panic,
    clippy::print_stdout,
    clippy::print_stderr
)]
#![deny(unsafe_op_in_unsafe_fn)]
pub mod constants;
pub mod enums;
pub mod errors;
pub mod middleware;
pub mod pointer_registry;
pub mod request_handler;
pub mod router;
pub mod structure;
mod thread_pool;
pub mod utils;

// Re-export test helpers located in ../tests_tools for use in unit tests.
#[cfg(test)]
#[path = "../tests/utils/mod.rs"]
pub mod test_utils;

#[cfg(test)]
mod pointer_registry_test;

use std::io;
use std::{
    ffi::CStr,
    os::raw::c_char,
    sync::{mpsc},
    time::Duration,
};
use tracing_subscriber::{fmt, EnvFilter};

use crate::enums::HttpMethod;
use crate::errors::{HttpServerError, HttpServerErrorCode};
use crate::request_handler::{
    callback_handle_request, handle as process_request, HandleRequestCallback,
};
use crate::router::errors::RouterErrorCode;
use crate::router::structures::RouterError;
use crate::structure::AddRouteResult;
use crate::thread_pool::{shutdown_pool, submit_job};
use crate::utils::ffi::{make_result, parse_json_pointer};
mod http_server;
use http_server::server::HttpServer;
use http_server::HttpServerId;
use http_server::{
    lookup as lookup_http_server, register as register_http_server,
    unregister as unregister_http_server,
};
// `string` utilities not needed in this function anymore

// `HttpServerHandle` is re-exported from `http_server::types`.

// Global registry for instances. ID 0 is reserved as invalid/null.
// registry implementation lives in `http_server_registry` module

fn make_router_sealed_error(
    operation: &str,
    extra_detail: serde_json::Value,
    bulk: bool,
) -> RouterError {
    let mut detail = serde_json::json!({
        "operation": operation,
        "reason": "router_sealed"
    });

    if let serde_json::Value::Object(ref mut d) = detail
        && let serde_json::Value::Object(extra) = extra_detail
    {
        d.extend(extra);
    }

    RouterError::new(
        RouterErrorCode::RouterSealedCannotInsert,
        "router",
        "route_registration",
        "validation",
        if bulk {
            "Router is sealed; cannot insert bulk routes".to_string()
        } else {
            "Router is sealed; cannot insert routes".to_string()
        },
        Some(detail),
    )
}

#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "construct"))]
pub extern "C" fn construct(_routes_ptr: *const u8) -> HttpServerId {
    // Force logger to write to stderr so embedding runtimes (like Bun) capture logs reliably.
    let subscriber = fmt()
        .with_env_filter(EnvFilter::new("trace"))
        .with_writer(io::stderr)
        .with_ansi(false)
        .finish();

    tracing::subscriber::set_global_default(subscriber).expect("Failed to set global logger");

    tracing::info!("Bunner Rust Http Server initialized.");

    let boxed = Box::new(HttpServer::new());
    register_http_server(boxed)
}

/// Destroys the HttpServer instance and frees all associated memory.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
/// After calling this function, the handle is dangling and must not be used again.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation="destroy", handle=?handle))]
pub unsafe extern "C" fn destroy(handle: HttpServerId) {
    tracing::event!(tracing::Level::INFO, "http_server destroy called");

    if let Some(ptr) = unregister_http_server(handle) {
        let http_server = unsafe { Box::from_raw(ptr) };

        drop(http_server);
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
    handle: HttpServerId,
    http_method: u8,
    path: *const c_char,
) -> *mut u8 {
    let http_server_ptr = match lookup_http_server(handle) {
        Some(p) => p,
        None => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::HandleIsNull,
                "http_server",
                "add_route",
                "validation",
                "Invalid handle id passed to add_route".to_string(),
                Some(serde_json::json!(null)),
            );

            return make_result(&http_error);
        }
    };

    if path.is_null() {
        let err = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "http_server",
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
                "http_server",
                "add_route",
                "validation",
                "Invalid httpMethod value when adding route".to_string(),
                Some(serde_json::json!({
                    "httpMethod": http_method,
                    "pathPtr": format!("{:p}", path)
                })),
            );

            return make_result(&err);
        }
    };

    let http_server = unsafe { &*http_server_ptr };
    let path_str = unsafe { CStr::from_ptr(path) }.to_string_lossy();

    // Check sealed state with a short-lived read lock before acquiring write
    if http_server.router.read().is_sealed() {
        let e = make_router_sealed_error(
            "add_route",
            serde_json::json!({
              "path": path_str,
            }),
            false,
        );
        let he = HttpServerError::from(e);
        return make_result(&he);
    }

    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;

    match router_mut.add(http_method, &path_str) {
        Ok(k) => make_result(&AddRouteResult { key: k }),
        Err(e) => {
            tracing::event!(tracing::Level::ERROR, code=?e.code, path=%path_str, "add_route error");

            let mut bunner_error = HttpServerError::from(e);
            let detail = serde_json::json!({"path": path_str});

            bunner_error.merge_extra(detail);

            make_result(&bunner_error)
        }
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
pub unsafe extern "C" fn add_routes(handle: HttpServerId, routes_ptr: *const u8) -> *mut u8 {
    let http_server_ptr = match lookup_http_server(handle) {
        Some(p) => p,
        None => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::HandleIsNull,
                "http_server",
                "add_routes",
                "validation",
                "Invalid handle id passed to add_routes".to_string(),
                Some(serde_json::json!(null)),
            );

            return make_result(&http_error);
        }
    };

    if routes_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidRoutes,
            "http_server",
            "add_routes",
            "validation",
            "Routes pointer is null".to_string(),
            Some(serde_json::json!(null)),
        );

        return make_result(&http_error);
    }

    let routes: Vec<(HttpMethod, String)> =
        match unsafe { parse_json_pointer::<Vec<(HttpMethod, String)>>(routes_ptr) } {
            Ok(v) => v,
            Err(_) => {
                let http_error = HttpServerError::new(
                    HttpServerErrorCode::InvalidRoutes,
                    "http_server",
                    "add_routes",
                    "parsing",
                    "Invalid JSON string for routes list".to_string(),
                    Some(serde_json::json!({"routesPtr": format!("{:p}", routes_ptr)})),
                );

                return make_result(&http_error);
            }
        };

    let http_server = unsafe { &*http_server_ptr };
    let routes_count = routes.len();

    // Check sealed state with a short-lived read lock before acquiring write
    if http_server.router.read().is_sealed() {
        let detail = serde_json::json!({ "count": routes_count });
        let be = make_router_sealed_error("add_routes", detail, true);
        let he = HttpServerError::from(be);

        return make_result(&he);
    }

    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;

    match router_mut.add_bulk(routes) {
        Ok(r) => {
            let cnt = r.len();

            tracing::event!(tracing::Level::DEBUG, count = cnt as u64, "routes added");

            make_result(&r)
        }
        Err(e) => {
            tracing::event!(tracing::Level::ERROR, code=?e.code, count=routes_count as u64, "add_routes error");

            let mut bunner_error = HttpServerError::from(e);

            bunner_error.merge_extra(serde_json::json!({
                "count": routes_count
            }));

            make_result(&bunner_error)
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
    handle: HttpServerId,
    request_id_ptr: *const c_char,
    payload_ptr: *const u8,
    cb: HandleRequestCallback,
) {
    let http_server_ptr = match lookup_http_server(handle) {
        Some(p) => p,
        None => {
            let err = HttpServerError::new(
                HttpServerErrorCode::HandleIsNull,
                "http_server",
                "handle_request",
                "system",
                "Invalid handle id passed to handle_request".to_string(),
                Some(serde_json::json!(null)),
            );

            callback_handle_request(cb, None, None, &err);

            return;
        }
    };

    if request_id_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidRequestId,
            "http_server",
            "handle_request",
            "validation",
            "Request id pointer is null".to_string(),
            Some(serde_json::json!(null)),
        );

        callback_handle_request(cb, None, None, &http_error);

        return;
    }

    if payload_ptr.is_null() {
        let err = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "http_server",
            "handle_request",
            "validation",
            "Payload pointer is null".to_string(),
            Some(serde_json::json!(null)),
        );

        callback_handle_request(cb, None, None, &err);

        return;
    }

    let http_server = unsafe { &*http_server_ptr };
    // Acquire a short-lived read lock to obtain the read-only snapshot
    let ro_opt = {
        let rguard = http_server.router.read();
        rguard.get_readonly()
    };

    if ro_opt.is_none() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::RouteNotSealed,
            "router",
            "seal",
            "validation",
            "Routes not sealed; call seal_routes before handling requests".to_string(),
            None,
        );

        callback_handle_request(cb, None, None, &http_error);

        return;
    }

    let ro = ro_opt.unwrap();
    let request_id_ptr_usize = request_id_ptr as usize;
    let payload_ptr_usize = payload_ptr as usize;
    let (ack_tx, ack_rx) = mpsc::channel::<()>();

    match submit_job(Box::new(move || {
        let payload_ptr = payload_ptr_usize as *const u8;
        let request_id_ptr = request_id_ptr_usize as *const c_char;

        unsafe { process_request(cb, request_id_ptr, payload_ptr, ro, ack_tx) };
    })) {
        Ok(()) => {
            tracing::event!(tracing::Level::DEBUG, "request enqueued");
        }
        Err(_e) => {
            tracing::event!(
                tracing::Level::WARN,
                reason = "queue_full",
                "Failed to enqueue request; queue may be full"
            );

            let http_error = HttpServerError::new(
                HttpServerErrorCode::QueueFull,
                "thread_pool",
                "enqueue",
                "backpressure",
                "Request queue is full".to_string(),
                None,
            );

            callback_handle_request(cb, None, None, &http_error);
        }
    }

    let parsing_timeout = Duration::from_millis(1000);

    match ack_rx.recv_timeout(parsing_timeout) {
        Ok(()) => {}
        Err(mpsc::RecvTimeoutError::Timeout) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::RequestAckTimeout,
                "http_server",
                "handle_request",
                "timeout",
                "Worker did not ack request parsing within timeout".to_string(),
                None,
            );

            callback_handle_request(cb, None, None, &http_error);
        }
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::RequestAckTimeout,
                "http_server",
                "handle_request",
                "channel",
                "Failed to receive ack from worker".to_string(),
                None,
            );

            callback_handle_request(cb, None, None, &http_error);
        }
    }
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "seal_routes"))]
pub unsafe extern "C" fn seal_routes(handle: HttpServerId) -> *mut u8 {
    let http_server_ptr = match lookup_http_server(handle) {
        Some(p) => p,
        None => {
            let err = HttpServerError::new(
                HttpServerErrorCode::HandleIsNull,
                "http_server",
                "seal_routes",
                "system",
                "Invalid handle id passed to seal_routes".to_string(),
                Some(serde_json::json!(null)),
            );

            return make_result(&err);
        }
    };
    let http_server = unsafe { &*http_server_ptr };

    http_server.seal_routes();

    tracing::event!(tracing::Level::INFO, "routes sealed");

    make_result(&serde_json::json!({"result": true}))
}

/// Frees a raw buffer previously returned by `serialize_and_to_len_prefixed_buffer`.
///
/// # Safety
/// - `ptr` must be a pointer previously returned by a Rust function in this crate
///   that registered the buffer via `pointer_registry::register_raw_vec_and_into_raw`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn free(handle: HttpServerId, ptr: *mut u8) {
    let http_server_ptr = match lookup_http_server(handle) {
        Some(p) => p,
        None => {
            return;
        }
    };
    unsafe { pointer_registry::free(ptr) };
}

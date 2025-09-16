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

#[cfg(test)]
mod pointer_registry_test;

use std::{
    ffi::CStr,
    os::raw::c_char,
    sync::{Arc, OnceLock},
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
use crate::utils::string;

pub type HttpServerHandle = *mut HttpServer;

#[repr(C)]
pub struct HttpServer {
    router: parking_lot::RwLock<router::Router>,
    router_readonly: OnceLock<Arc<router::RouterReadOnly>>,
    cancel_map: parking_lot::RwLock<hashbrown::HashMap<String, Arc<std::sync::atomic::AtomicBool>>>,
}

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
#[tracing::instrument(skip_all, fields(operation = "init"))]
pub extern "C" fn init() -> HttpServerHandle {
    let subscriber = fmt().with_env_filter(EnvFilter::new("trace")).finish();

    tracing::subscriber::set_global_default(subscriber).expect("Failed to set global logger");

    tracing::info!("Bunner Rust Http Server initialized.");

    let server = Box::new(HttpServer {
        router: parking_lot::RwLock::new(router::Router::new(None)),
        router_readonly: OnceLock::new(),
        cancel_map: parking_lot::RwLock::new(hashbrown::HashMap::new()),
    });

    Box::into_raw(server)
}

/// Destroys the HttpServer instance and frees all associated memory.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
/// After calling this function, the handle is dangling and must not be used again.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation="destroy", handle=?handle))]
pub unsafe extern "C" fn destroy(handle: HttpServerHandle) {
    tracing::event!(tracing::Level::INFO, "http_server destroy called");

    if handle.is_null() {
        shutdown_pool();
        return;
    }

    let http_server = unsafe { Box::from_raw(handle) };

    drop(http_server);

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
    handle: HttpServerHandle,
    http_method: u8,
    path: *const c_char,
) -> *mut u8 {
    if handle.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "http_server",
            "add_route",
            "validation",
            format!("Null handle passed to {}", "add_route"),
            Some(serde_json::json!(null)),
        );

        return make_result(&http_error);
    }

    // Check if path pointer is null
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

    let http_server = unsafe { &*handle };
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
    let path_str = unsafe { CStr::from_ptr(path) }.to_string_lossy();

    if http_server.router_readonly.get().is_some() {
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
pub unsafe extern "C" fn add_routes(handle: HttpServerHandle, routes_ptr: *const u8) -> *mut u8 {
    if handle.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "http_server",
            "add_routes",
            "validation",
            format!("Null handle passed to {}", "add_routes"),
            Some(serde_json::json!(null)),
        );

        return make_result(&http_error);
    }

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
        match parse_json_pointer::<Vec<(HttpMethod, String)>>(routes_ptr) {
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

    let http_server = unsafe { &*handle };
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
    let routes_count = routes.len();

    if http_server.router_readonly.get().is_some() {
        let detail = serde_json::json!({ "count": routes_count });
        let be = make_router_sealed_error("add_routes", detail, true);
        let he = HttpServerError::from(be);

        return make_result(&he);
    }

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
    handle: HttpServerHandle,
    request_id_ptr: *const c_char,
    payload_ptr: *const c_char,
    cb: HandleRequestCallback,
) {
    if handle.is_null() {
        let err = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "http_server",
            "handle_request",
            "system",
            "Null handle passed to handle_request".to_string(),
            Some(serde_json::json!(null)),
        );

        callback_handle_request(cb, None, None, &err);

        return;
    }

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

    let request_id_str = {
        match unsafe { CStr::from_ptr(request_id_ptr).to_str() } {
            Ok(s) => s,
            Err(_) => {
                let http_error = HttpServerError::new(
                    HttpServerErrorCode::InvalidRequestId,
                    "http_server",
                    "handle_request",
                    "parsing",
                    "Request id is not valid UTF-8".to_string(),
                    Some(serde_json::json!({"requestIdPtr": format!("{:p}", request_id_ptr)})),
                );

                callback_handle_request(cb, None, None, &http_error);

                return;
            }
        }
    };

    if payload_ptr.is_null() {
        let err = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "http_server",
            "handle_request",
            "validation",
            "Payload pointer is null".to_string(),
            Some(serde_json::json!({"requestId": request_id_str})),
        );

        callback_handle_request(cb, Some(request_id_str), None, &err);

        return;
    }

    let payload_str = match unsafe { string::cstr_to_str(payload_ptr) } {
        Ok(s) => s,
        Err(_) => {
            let err = HttpServerError::new(
                HttpServerErrorCode::InvalidPayload,
                "http_server",
                "handle_request",
                "parsing",
                "Payload is not valid UTF-8 JSON".to_string(),
                Some(
                    serde_json::json!({"requestId": request_id_str, "payloadPtr": format!("{:p}", payload_ptr)}),
                ),
            );

            callback_handle_request(cb, Some(request_id_str), None, &err);

            return;
        }
    };

    let payload_owned: String = payload_str.to_owned();
    let payload_len_for_log: usize = payload_owned.len();
    let http_server = unsafe { &*handle };
    let ro_opt = http_server.router_readonly.get().map(Arc::clone);

    if ro_opt.is_none() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::RouteNotSealed,
            "router",
            "seal",
            "validation",
            "Routes not sealed; call seal_routes before handling requests".to_string(),
            Some(serde_json::json!({"requestId": request_id_str})),
        );

        callback_handle_request(cb, Some(request_id_str), None, &http_error);

        return;
    }

    let request_id_owned = request_id_str.to_owned();
    let ro = ro_opt.unwrap();
    let cancel_flag = {
        let mut map = http_server.cancel_map.write();
        let f = Arc::new(std::sync::atomic::AtomicBool::new(false));

        map.insert(request_id_owned.clone(), Arc::clone(&f));

        f
    };

    match submit_job(Box::new(move || {
        // Worker will always perform the callback; main thread only observes enqueue success/failure
        process_request(
            cb,
            request_id_owned.clone(),
            payload_owned,
            ro,
            Some(cancel_flag),
        );

        // cleanup cancel map entry best-effort (can't access server here; leave for timeout GC or future hook)
        let _ = request_id_owned;
    })) {
        Ok(()) => {
            tracing::event!(tracing::Level::DEBUG, "request enqueued");
        }
        Err(_e) => {
            tracing::event!(
                tracing::Level::WARN,
                reason = "queue_full",
                request_id = %request_id_str,
                payload_len = payload_len_for_log as u64
            );

            let http_error = HttpServerError::new(
                HttpServerErrorCode::QueueFull,
                "thread_pool",
                "enqueue",
                "backpressure",
                "Request queue is full".to_string(),
                Some(serde_json::json!({"requestId": request_id_str})),
            );

            callback_handle_request(cb, Some(request_id_str), None, &http_error);
        }
    }
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "seal_routes"))]
pub unsafe extern "C" fn seal_routes(handle: HttpServerHandle) {
    let http_server = unsafe { &*handle };

    {
        let mut guard = http_server.router.write();

        guard.finalize();

        // Build read-only after finalize
        let ro = guard.build_readonly();
        let _ = http_server.router_readonly.set(Arc::new(ro));

        // Drop the builder router by replacing with a minimal empty sealed router
        *guard = router::Router::new(None);

        guard.finalize();
    }

    tracing::event!(tracing::Level::INFO, "routes sealed");
}

/// Frees a raw buffer previously returned by `serialize_and_to_len_prefixed_buffer`.
///
/// # Safety
/// - `ptr` must be a pointer previously returned by a Rust function in this crate
///   that registered the buffer via `pointer_registry::register_raw_vec_and_into_raw`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn free(ptr: *mut u8) {
    unsafe { pointer_registry::free(ptr) };
}

/// Cancels an in-flight request by id (no callback will be sent if not already).
///
/// # Safety
/// - `handle` must be a valid pointer returned by `init`.
/// - `request_id_ptr` must be a valid, non-null, null-terminated C string pointer to the request id.
/// - The pointer must remain valid for the duration of the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn cancel_request(handle: HttpServerHandle, request_id_ptr: *const c_char) {
    if handle.is_null() || request_id_ptr.is_null() {
        return;
    }
    let http_server = unsafe { &*handle };
    if let Ok(s) = unsafe { CStr::from_ptr(request_id_ptr) }.to_str() {
        let map = http_server.cancel_map.write();
        if let Some(flag) = map.get(s) {
            flag.store(true, std::sync::atomic::Ordering::SeqCst);
        }
    }
}

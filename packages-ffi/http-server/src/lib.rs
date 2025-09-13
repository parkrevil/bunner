#![deny(
    clippy::dbg_macro,
    clippy::todo,
    clippy::unimplemented,
    clippy::panic,
    clippy::print_stdout,
    clippy::print_stderr
)]
#![deny(unsafe_op_in_unsafe_fn)]
pub mod enums;
pub mod errors;
pub mod helpers;
pub mod middleware;
pub mod request_handler;
pub mod router;
pub mod structure;
pub mod util;
mod callback_dispatcher;
mod thread_pool;

use crate::enums::HttpMethod;
use crate::errors::HttpServerErrorCode;
use crate::helpers::callback_handle_request;
use crate::router::errors::RouterErrorCode as RCode;
use crate::router::structures::RouterError as RError;
use crate::structure::{AddRouteResult, HttpServerError};
use crate::util::{
     serialize_to_cstring
};
use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
    sync::{Arc, OnceLock},
};
use crate::thread_pool::submit_job;

use crate::thread_pool::shutdown_pool;

// Helper function to reduce code duplication
fn handle_null_handle_error(operation: &str) -> *mut c_char {
    let http_error = HttpServerError::new(
        HttpServerErrorCode::HandleIsNull,
        "http_server",
        operation,
        "validation",
        format!("Null handle passed to {}", operation),
        Some(serde_json::json!(null)),
    );
    serialize_to_cstring(&http_error)
}

#[cfg(feature = "test")]
pub mod thread_pool_test_support {
    pub fn submit<F>(job: F) -> Result<(), &'static str>
    where
        F: FnOnce() + Send + 'static,
    {
        match crate::thread_pool::submit_job(Box::new(job)) {
            Ok(()) => Ok(()),
            Err(crossbeam_channel::TrySendError::Full(_)) => Err("full"),
            Err(crossbeam_channel::TrySendError::Disconnected(_)) => Err("disconnected"),
        }
    }

    pub fn shutdown() {
        crate::thread_pool::shutdown_pool();
    }

    pub fn set_force_full(value: bool) {
        crate::thread_pool::set_force_full(value);
    }
}

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
) -> RError {
    let mut detail = serde_json::json!({
        "operation": operation,
        "reason": "router_sealed"
    });
    if let serde_json::Value::Object(ref mut d) = detail
        && let serde_json::Value::Object(extra) = extra_detail
    {
        d.extend(extra);
    }
    RError::new(
        RCode::RouterSealedCannotInsert,
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

/// Initializes a new HttpServer instance and returns its handle.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation = "init"))]
pub extern "C" fn init() -> HttpServerHandle {
    tracing::event!(tracing::Level::INFO, "http_server init");
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
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(operation="add_route", http_method=http_method))]
pub unsafe extern "C" fn add_route(
    handle: HttpServerHandle,
    http_method: u8,
    path: *const c_char,
) -> *mut c_char {
    if handle.is_null() {
        return handle_null_handle_error("add_route");
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
        return serialize_to_cstring(&err);
    }

    let http_method = match HttpMethod::from_u8(http_method) {
        Ok(m) => m,
        Err(e) => {
            let detail = serde_json::json!({
                    "httpMethod": http_method,
                    "pathPtr": format!("{:p}", path)
                });
            let err = HttpServerError::new(
                e,
                "http_server",
                "add_route",
                "validation",
                "Invalid httpMethod value when adding route".to_string(),
                Some(detail),
            );
            return serialize_to_cstring(&err);
        }
    };
    let http_server = unsafe { &*handle };
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
    let path_str = unsafe { CStr::from_ptr(path) }.to_string_lossy();

    if http_server.router_readonly.get().is_some() {
        let detail = serde_json::json!({ "path": path_str });
        let e = make_router_sealed_error("add_route", detail, false);
        let he = HttpServerError::from(e);
        return serialize_to_cstring(&he);
    }

    match router_mut.add(http_method, &path_str) {
        Ok(k) => {
            tracing::event!(tracing::Level::DEBUG, method=?http_method, path=%path_str, key=k, "route added");
            serialize_to_cstring(&AddRouteResult { key: k })
        }
        Err(e) => {
            tracing::event!(tracing::Level::ERROR, code=?e.code, path=%path_str, "add_route error");
            let mut bunner_error = HttpServerError::from(e);
            let detail =
                serde_json::json!({"path": path_str});

            bunner_error.merge_extra(detail);

            serialize_to_cstring(&bunner_error)
        }
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
#[tracing::instrument(skip_all, fields(operation = "add_routes"))]
pub unsafe extern "C" fn add_routes(
    handle: HttpServerHandle,
    routes_ptr: *const c_char,
) -> *mut c_char {
    if handle.is_null() {
        return handle_null_handle_error("add_routes");
    }

    // Check if routes_ptr is null
    if routes_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "http_server",
            "add_routes",
            "validation",
            "Routes pointer is null".to_string(),
            Some(serde_json::json!(null)),
        );
        return serialize_to_cstring(&http_error);
    }

    let routes_str = match unsafe { CStr::from_ptr(routes_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidJsonString,
                "http_server",
                "add_routes",
                "parsing",
                "Invalid UTF-8 JSON string passed to add_routes".to_string(),
                Some(serde_json::json!({
                    "reason": "non_utf8",
                    "routesPtr": format!("{:p}", routes_ptr)
                })),
            );
            return serialize_to_cstring(&http_error);
        }
    };

    // Typed error handling: first parse as (u8, String), then validate method values explicitly
    let routes_u8: Vec<(u8, String)> = match serde_json::from_str::<Vec<(u8, String)>>(routes_str) {
        Ok(r) => r,
        Err(e) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidJsonString,
                "http_server",
                "add_routes",
                "parsing",
                "Invalid JSON string for routes list".to_string(),
                Some(serde_json::json!({"routesLength": routes_str.len(), "routesPreview": routes_str.chars().take(200).collect::<String>(), "serdeError": e.to_string()})),
            );
            return serialize_to_cstring(&http_error);
        }
    };

    let mut routes: Vec<(HttpMethod, String)> = Vec::with_capacity(routes_u8.len());
    for (m, p) in routes_u8.into_iter() {
        match HttpMethod::from_u8(m) {
            Ok(hm) => routes.push((hm, p)),
            Err(_) => {
                let http_error = HttpServerError::new(
                    HttpServerErrorCode::InvalidHttpMethod,
                    "http_server",
                    "add_routes",
                    "validation",
                    "Invalid HTTP method in routes payload".to_string(),
                    Some(serde_json::json!({"invalidMethod": m})),
                );
                return serialize_to_cstring(&http_error);
            }
        }
    }

    let http_server = unsafe { &*handle };
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
    let routes_count = routes.len();

    if http_server.router_readonly.get().is_some() {
        let detail = serde_json::json!({ "count": routes_count });
        let be = make_router_sealed_error("add_routes", detail, true);
        let he = HttpServerError::from(be);
        return serialize_to_cstring(&he);
    }

    match router_mut.add_bulk(routes) {
        Ok(r) => {
            let cnt = r.len();
            tracing::event!(tracing::Level::DEBUG, count = cnt as u64, "routes added");
            serialize_to_cstring(&r)
        }
        Err(e) => {
            tracing::event!(tracing::Level::ERROR, code=?e.code, count=routes_count as u64, "add_routes error");
            let mut bunner_error = HttpServerError::from(e);
            let detail = serde_json::json!({
              "count": routes_count
            });

            bunner_error.merge_extra(detail);

            serialize_to_cstring(&bunner_error)
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
    cb: extern "C" fn(*const c_char, u16, *mut c_char),
) {
    if handle.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "http_server",
            "handle_request",
            "system",
            "Null handle passed to handle_request".to_string(),
            Some(serde_json::json!(null)),
        );
        callback_handle_request(cb, None, 0, &http_error);
        return;
    }

    // If request_id is null, return InvalidRequestId error
    if request_id_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidRequestId,
            "http_server",
            "handle_request",
            "validation",
            "Request id pointer is null".to_string(),
            Some(serde_json::json!(null)),
        );
        callback_handle_request(cb, None, 0, &http_error);
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
                callback_handle_request(cb, None, 0, &http_error);
                return;
            }
        }
    };

    // If payload pointer is null, return InvalidPayload error
    if payload_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "http_server",
            "handle_request",
            "validation",
            "Payload pointer is null".to_string(),
            Some(serde_json::json!({"requestId": request_id_str})),
        );
        callback_handle_request(cb, Some(request_id_str), 0, &http_error);
        return;
    }

    let payload_str = match unsafe { CStr::from_ptr(payload_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidJsonString,
                "http_server",
                "handle_request",
                "parsing",
                "Payload is not valid UTF-8 JSON".to_string(),
                Some(serde_json::json!({"requestId": request_id_str, "payloadPtr": format!("{:p}", payload_ptr)})),
            );
            callback_handle_request(cb, Some(request_id_str), 0, &http_error);
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

        callback_handle_request(cb, Some(request_id_str), 0, &http_error);

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
        request_handler::process_job(
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
            callback_handle_request(cb, Some(request_id_str), 0, &http_error);
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

/// Cancels an in-flight request by id (no callback will be sent if not already).
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

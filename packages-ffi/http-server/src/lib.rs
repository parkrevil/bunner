pub mod r#enum;
pub mod errors;
pub mod middleware;
pub mod request_handler;
pub mod router;
pub mod structure;
mod thread_pool;
pub mod util;
pub mod helpers;

use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
    ptr,
    sync::Arc,
};
use crate::errors::HttpServerErrorCode;
use crate::structure::{AddRouteResult, HttpServerError};
use crate::util::{make_ffi_bunner_error_result, serialize_to_cstring};
use crate::r#enum::HttpMethod;
use crate::util::make_ffi_result;
use crate::helpers::callback_handle_request;
use serde::Serialize;
use thread_pool::submit_job;


#[cfg(feature = "test")]
use thread_pool::shutdown_pool;

#[cfg(feature = "test")]
pub mod thread_pool_test_support {
    use std::sync::mpsc::TrySendError;

    pub fn submit<F>(job: F) -> Result<(), &'static str>
    where
        F: FnOnce() + Send + 'static,
    {
        match crate::thread_pool::submit_job(Box::new(job)) {
            Ok(()) => Ok(()),
            Err(TrySendError::Full(_)) => Err("full"),
            Err(TrySendError::Disconnected(_)) => Err("disconnected"),
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
    router_readonly: Arc<parking_lot::RwLock<Option<Arc<router::RouterReadOnly>>>>,
}

fn make_router_sealed_error(operation: &str, extra_detail: serde_json::Value, bulk: bool) -> HttpServerError {
    let mut detail = serde_json::json!({
        "operation": operation,
        "reason": "router_sealed"
    });
    if let serde_json::Value::Object(ref mut d) = detail {
        if let serde_json::Value::Object(extra) = extra_detail {
            d.extend(extra);
        }
    }
    HttpServerError::new(
        HttpServerErrorCode::RouterSealedCannotInsert,
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
pub extern "C" fn init() -> HttpServerHandle {
    let server = Box::new(HttpServer {
        router: parking_lot::RwLock::new(router::Router::new(None)),
        router_readonly: Arc::new(parking_lot::RwLock::new(None)),
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
    if handle.is_null() {
        #[cfg(feature = "test")]
        shutdown_pool();

        return;
    }
    
    let http_server = unsafe { Box::from_raw(handle) };

    drop(http_server);

    #[cfg(feature = "test")]
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
        let http_error = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "Handle is null".to_string(),
            Some(serde_json::json!({"operation": "add_route"}))
        );
        return serialize_to_cstring(&http_error);
    }

    let http_method = match HttpMethod::from_u8(http_method) {
        Ok(m) => m,
        Err(e) => return serialize_to_cstring(&HttpServerError::new(
            e,
            format!("Error occurred: {:?}", e),
            None,
        )),
    };
    let http_server = unsafe { &*handle };
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
    let path_str = unsafe { CStr::from_ptr(path) }.to_string_lossy();

    if http_server.router_readonly.read().as_ref().is_some() {
        let detail = serde_json::json!({ "path": path_str });
        let e = make_router_sealed_error("add_route", detail, false);
        return make_ffi_bunner_error_result(&e);
    }

    match router_mut.add(http_method, &path_str) {
        Ok(k) => {
            make_ffi_result(&AddRouteResult { key: k })
        }
        Err(e) => {
            let mut bunner_error = HttpServerError::from(e);
            let detail = serde_json::json!({"operation": "add_route", "path": path_str});

            bunner_error.merge_detail(detail);

            make_ffi_bunner_error_result(&bunner_error)
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
pub unsafe extern "C" fn add_routes(
    handle: HttpServerHandle,
    routes_ptr: *const c_char,
) -> *mut c_char {
    if handle.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "Handle is null".to_string(),
            Some(serde_json::json!({"operation": "add_routes"}))
        );
        return serialize_to_cstring(&http_error);
    }

    let routes_str = match unsafe { CStr::from_ptr(routes_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidJsonString,
                "Invalid JSON string".to_string(),
                Some(serde_json::json!({"operation": "add_routes"}))
            );
            return serialize_to_cstring(&http_error);
        }
    };

    let routes: Vec<(HttpMethod, String)> =
        match serde_json::from_str::<Vec<(HttpMethod, String)>>(routes_str) {
            Ok(r) => r,
            Err(e) => {
                let msg = e.to_string();

                if msg.contains("InvalidHttpMethod") {
                    let http_error = HttpServerError::new(
                        HttpServerErrorCode::InvalidHttpMethod,
                        "Invalid HTTP method".to_string(),
                        Some(serde_json::json!({"operation": "add_routes"}))
                    );
                    return serialize_to_cstring(&http_error);
                } else {
                    let http_error = HttpServerError::new(
                        HttpServerErrorCode::InvalidJsonString,
                        "Invalid JSON string".to_string(),
                        Some(serde_json::json!({"operation": "add_routes"}))
                    );
                    return serialize_to_cstring(&http_error);
                }
            }
        };

    let http_server = unsafe { &*handle };
    let mut guard = http_server.router.write();
    let router_mut = &mut *guard;
    let routes_count = routes.len();

    if http_server.router_readonly.read().as_ref().is_some() {
        let detail = serde_json::json!({ "count": routes_count });
        let be = make_router_sealed_error("add_routes", detail, true);
        return make_ffi_bunner_error_result(&be);
    }

    match router_mut.add_bulk(routes) {
        Ok(r) => make_ffi_result(r),
        Err(e) => {
            let mut bunner_error = HttpServerError::from(e);
            let detail = serde_json::json!({
              "operation": "add_routes",
              "count": routes_count
            });

            bunner_error.merge_detail(detail);

            make_ffi_bunner_error_result(&bunner_error)
        }
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
    payload_ptr: *const c_char,
    cb: extern "C" fn(*const c_char, u16, *mut c_char),
) {
    if handle.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::HandleIsNull,
            "Handle is null".to_string(),
            Some(serde_json::json!({"operation": "handle_request"}))
        );
        callback_handle_request(
            cb,
            None,
            0,
            &http_error,
        );
        return;
    }

    // If request_id is null, return InvalidRequestId error
    if request_id_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidRequestId,
            "Invalid request id".to_string(),
            Some(serde_json::json!({"operation": "handle_request"}))
        );
        callback_handle_request(
            cb,
            None,
            0,
            &http_error,
        );
        return;
    }

    let request_id_str = {
        match unsafe { CStr::from_ptr(request_id_ptr).to_str() } {
            Ok(s) => s,
            Err(_) => {
                let http_error = HttpServerError::new(
                    HttpServerErrorCode::InvalidRequestId,
                    "Invalid request id".to_string(),
                    Some(serde_json::json!({"operation": "handle_request"}))
                );
                callback_handle_request(
                    cb,
                    None,
                    0,
                    &http_error,
                );
                return;
            }
        }
    };

    // If payload pointer is null, return InvalidPayload error
    if payload_ptr.is_null() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::InvalidPayload,
            "Invalid payload".to_string(),
            Some(serde_json::json!({"operation": "handle_request"}))
        );
        callback_handle_request(
            cb,
            Some(&request_id_str),
            0,
            &http_error,
        );
        return;
    }

    let payload_str = match unsafe { CStr::from_ptr(payload_ptr).to_str() } {
        Ok(s) => s,
        Err(_) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::InvalidJsonString,
                "Invalid JSON string".to_string(),
                Some(serde_json::json!({"operation": "handle_request"}))
            );
            callback_handle_request(
                cb,
                Some(&request_id_str),
                0,
                &http_error,
            );
            return;
        }
    };

    let payload_owned: String = payload_str.to_owned();
    let http_server = unsafe { &*handle };
    let ro_opt = {
        let ro_guard = http_server.router_readonly.read();

        ro_guard.as_ref().map(Arc::clone)
    };

    if ro_opt.is_none() {
        let http_error = HttpServerError::new(
            HttpServerErrorCode::RouteNotSealed,
            "Route not sealed".to_string(),
            Some(serde_json::json!({"operation": "handle_request"}))
        );

        callback_handle_request(
            cb,
            Some(&request_id_str),
            0,
            &http_error,
        );

        return;
    }

    let request_id_owned = request_id_str.to_owned();
    let ro = ro_opt.unwrap();
    let payload_owned_for_job = payload_owned;

    let (done_tx, done_rx) = std::sync::mpsc::channel::<()>();
    match submit_job(Box::new(move || {
        request_handler::process_job(cb, request_id_owned, payload_owned_for_job, ro);

        let _ = done_tx.send(());
    })) {
        Ok(()) => {
            let _ = done_rx.recv();
        }
        Err(_e) => {
            let http_error = HttpServerError::new(
                HttpServerErrorCode::QueueFull,
                "Queue is full".to_string(),
                Some(serde_json::json!({"operation": "handle_request"}))
            );
            callback_handle_request(
                cb,
                Some(&request_id_str),
                0,
                &http_error,
            );
        }
    }
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn seal_routes(handle: HttpServerHandle) {
    let http_server = unsafe { &*handle };
    {
        let mut guard = http_server.router.write();

        guard.finalize();

        // Build read-only after finalize
        let ro = guard.build_readonly();
        {
            let mut s = http_server.router_readonly.write();
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

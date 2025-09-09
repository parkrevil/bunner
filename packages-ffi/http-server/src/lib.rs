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

pub type HttpServerHandle = *mut HttpServer;
pub struct RouterPtr(*mut router::Router);

#[repr(C)]
pub struct HttpServer {
    router: RouterPtr,
}

// thread pool moved to pool.rs

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

    submit_job(Box::new(move || {
        // TODO: route match using router_ptr (read-only after seal)
        let ok = HandleRequestResult {
            route_key: 0,
            params: None,
            query_params: None,
            body: None,
            response: None,
        };

        let request_id_c = CString::new(request_id_owned).unwrap();

        cb(request_id_c.as_ptr(), make_ffi_result(&ok));
        // Prevent double free: leak req_id_c to transfer ownership to caller? No, JS won't free it.
        // So we intentionally forget to keep pointer valid during callback only.
        std::mem::forget(request_id_c);
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

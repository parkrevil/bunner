pub mod errors;
pub mod router;

use router::ffi::RouterPtr;
use serde::Serialize;
use std::{ffi::CString, os::raw::c_char};

pub type HttpServerHandle = *mut HttpServer;

#[derive(Serialize)]
struct RouteResult {
    key: u64,
    error: u32,
}

#[repr(C)]
pub struct HttpServer {
    router: RouterPtr,
}

#[unsafe(no_mangle)]
pub extern "C" fn init() -> HttpServerHandle {
    let boxed = Box::new(router::Router::new());
    let router = RouterPtr(Box::into_raw(boxed));
    let http_server = Box::new(HttpServer { router });
    Box::into_raw(http_server)
}

/// Destroys the HttpServer instance and frees all associated memory.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
/// After calling this function, the handle is dangling and must not be used again.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn destroy(handle: HttpServerHandle) {
    if !handle.is_null() {
        let http_server = unsafe { Box::from_raw(handle) };

        if !http_server.router.0.is_null() {
            let _ = unsafe { Box::from_raw(http_server.router.0) };
        }

        drop(http_server);
    }
}

/// Adds a new route to the router.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `path` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn router_add(
    handle: HttpServerHandle,
    method: u32,
    path: *const c_char,
) -> *mut c_char {
    let http_server = unsafe { &*handle };
    let result_ptr = router::ffi::add(http_server.router, method, path);

    if result_ptr.is_null() {
        let result = RouteResult { key: 0, error: 1 }; // Generic error
        let json = serde_json::to_string(&result).unwrap();
        return CString::new(json).unwrap().into_raw();
    }

    let result_box = unsafe { Box::from_raw(result_ptr) };
    let result = RouteResult {
        key: result_box.key,
        error: result_box.error,
    };

    let json = serde_json::to_string(&result).unwrap();
    CString::new(json).unwrap().into_raw()
}

/// Finds a route that matches the given method and path.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `path` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn handle_request(
    handle: HttpServerHandle,
    method: u32,
    path: *const c_char,
) -> *mut c_char {
    let http_server = unsafe { &*handle };
    let result_ptr = router::ffi::find(http_server.router, method, path);

    if result_ptr.is_null() {
        let result = RouteResult { key: 0, error: 1 }; // Generic error
        let json = serde_json::to_string(&result).unwrap();

        return CString::new(json).unwrap().into_raw();
    }

    let result_box = unsafe { Box::from_raw(result_ptr) };
    let result = RouteResult {
        key: result_box.key,
        error: result_box.error,
    };

    let json = serde_json::to_string(&result).unwrap();
    CString::new(json).unwrap().into_raw()
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn router_seal(handle: HttpServerHandle) {
    let http_server = unsafe { &*handle };

    router::ffi::seal(http_server.router)
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

pub mod r#enum;
pub mod errors;
pub mod router;
pub mod structure;
pub mod util;

use std::{
    ffi::{CStr, CString},
    os::raw::c_char,
};

use crate::r#enum::HttpMethod;
use crate::errors::HttpServerError;
use crate::structure::{AddRouteResult, FfiError};
use crate::util::{make_ffi_error_result, make_ffi_result};

pub type HttpServerHandle = *mut HttpServer;
pub struct RouterPtr(*mut router::Router);

#[repr(C)]
pub struct HttpServer {
    router: RouterPtr,
}

#[unsafe(no_mangle)]
pub extern "C" fn init() -> HttpServerHandle {
    let router = Box::into_raw(Box::new(router::Router::new()));
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
pub unsafe extern "C" fn router_add(
    handle: HttpServerHandle,
    method_num: u8,
    path: *const c_char,
) -> *mut c_char {
    if handle.is_null() {
        return make_ffi_error_result(FfiError {
            code: HttpServerError::HandleIsNull.code(),
            message: None,
        });
    }

    let method_option = HttpMethod::from_u8(method_num);

    if method_option.is_none() {
        return make_ffi_error_result(FfiError {
            code: HttpServerError::InvalidHttpMethod.code(),
            message: None,
        });
    }

    let http_server = unsafe { &*handle };
    let router_mut = unsafe { &mut *http_server.router.0 };
    let method = method_option.unwrap();
    let path_str = unsafe { CStr::from_ptr(path) }.to_string_lossy();
    let result = match router_mut.add(method, &path_str) {
        Ok(k) => AddRouteResult {
            key: k,
            error: 0,
        },
        Err(e) => AddRouteResult {
            key: 0,
            error: e as u32,
        },
    };
    
    make_ffi_result(Some(result), None)
}

/// Finds a route that matches the given method and path from a serialized JSON request.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `request_json` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn handle_request(
    _handle: HttpServerHandle,
    _request_data: *const c_char,
) -> *mut c_char {
/*     let http_server = unsafe { &*handle };
    let request_str = match unsafe { CStr::from_ptr(request_data).to_str() } {
        Ok(s) => s,
        Err(e) => {
            return make_ffi_error_result(FfiError {
                code: HttpServerError::InvalidJsonString.code(),
                message: Some(e.to_string()),
            });
        }
    };

    let request: Request = match serde_json::from_str(request_str) {
        Ok(req) => req,
        Err(_) => {
            return make_ffi_error_result(FfiError {
                code: HttpServerError::InvalidJsonString.code(),
                message: Some("Invalid JSON format".to_string()),
            });
        }
    };

    let method = HttpMethod::from_str(request.http_method).unwrap_or(HttpMethod::Get);
    let path_cstring = CString::new(request.url).unwrap();
    let result_ptr = router::find(http_server.router, method, path_cstring.as_ptr());

    if result_ptr.is_null() {
        return make_ffi_error_result(FfiError {
            code: HttpServerError::RouteNotFound.code(),
            message: Some("Route not found".to_string()),
        });
    }

    let result_box: Box<FindRouteResult> = unsafe { Box::from_raw(result_ptr) };

    let success_result = HandleRequestResult {
        key: result_box.key,
        params: None, // TODO: Implement params
        error: result_box.error,
        error_message: None,
    };

    make_ffi_result(Some(success_result), None) */
    return make_ffi_error_result(FfiError {
      code: HttpServerError::RouteNotFound.code(),
      message: Some("Route not found".to_string()),
  });
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn router_seal(handle: HttpServerHandle) {
    let http_server = unsafe { &*handle };

    unsafe { &mut *http_server.router.0 }.finalize_routes()
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

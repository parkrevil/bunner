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
pub mod middlewares;
pub mod pointer_registry;
pub mod app_handle_request_dispatcher;
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

use std::io::Write;
use std::{ffi::CStr, os::raw::c_char};
use tracing_subscriber::{fmt, EnvFilter};

use crate::app::App;
use crate::app_registry::{find_app, register_app, unregister_app};
use crate::constants::ZERO_COPY_THRESHOLD;
use crate::enums::{HttpMethod, LenPrefixedString};
use crate::errors::{FfiError, FfiErrorCode};
use crate::structures::{AddRouteResult, AppOptions, InitResult};
use crate::thread_pool::shutdown_pool;
use crate::types::HandleRequestCallback;
use crate::types::{AppId, MutablePointer, ReadonlyPointer, RequestKey, StaticString, WorkerId};
use crate::utils::ffi::{deserialize_json_pointer, make_result, take_len_prefixed_pointer};

/// Constructs a new HttpServer instance from the given options pointer.
///
/// # Safety
/// The `options_ptr` must be a valid pointer to a length-prefixed JSON buffer representing `AppOptions`.
/// Passing an invalid pointer or malformed data is undefined behavior.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all)]
pub unsafe extern "C" fn init(options_ptr: ReadonlyPointer) -> MutablePointer {
    let options = match unsafe { deserialize_json_pointer::<AppOptions>(options_ptr) } {
        Ok(p) => p,
        Err(e) => {
            let err = FfiError::new(
                FfiErrorCode::InvalidArgument,
                "ffi",
                "construct",
                "parsing",
                e.to_string(),
                None,
            );

            tracing::event!(
                tracing::Level::ERROR,
                reason = "deserialize_construct_error"
            );

            return make_result(&err);
        }
    };

    let subscriber = fmt()
        .with_env_filter(EnvFilter::new(options.log_level().as_env_filter()))
        .finish();

    if let Err(_err) = tracing::subscriber::set_global_default(subscriber) {
        let _ = std::io::stderr().write_all(b"warning: global tracing subscriber already set\n");
    }

    tracing::debug!("AppOptions: {:?}", options);

    let app_id = register_app(options.name.as_str());

    tracing::info!("Bunner Rust Http Server initialized.");

    make_result(&InitResult { app_id })
}

/// Destroys the HttpServer instance and frees all associated memory.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
/// After calling this function, the handle is dangling and must not be used again.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(app_id=app_id))]
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
#[tracing::instrument(skip_all, fields(app_id=app_id))]
pub unsafe extern "C" fn add_route(
    app_id: AppId,
    worker_id: WorkerId,
    http_method: u8,
    path_ptr: *const c_char,
) -> MutablePointer {
    let app = match get_app(app_id, "add_route") {
        Ok(a) => a,
        Err(e) => return make_result(&e),
    };

    if path_ptr.is_null() {
        let err = FfiError::new(
            FfiErrorCode::InvalidArgument,
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
            let err = FfiError::new(
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
    let path_str = unsafe { CStr::from_ptr(path_ptr) }.to_string_lossy();

    match app.add_route(worker_id, http_method, &path_str) {
        Ok(k) => make_result(&AddRouteResult { key: k }),
        Err(e) => make_result(&FfiError::from(e)),
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
#[tracing::instrument(skip_all, fields(app_id=app_id))]
pub unsafe extern "C" fn add_routes(
    app_id: AppId,
    worker_id: WorkerId,
    routes_ptr: ReadonlyPointer,
) -> MutablePointer {
    let app = match get_app(app_id, "add_routes") {
        Ok(a) => a,
        Err(e) => return make_result(&e),
    };
    let routes = match unsafe { deserialize_json_pointer::<Vec<(HttpMethod, String)>>(routes_ptr) }
    {
        Ok(p) => p,
        Err(e) => {
            let err = FfiError::new(
                FfiErrorCode::InvalidArgument,
                "ffi",
                "add_routes",
                "parsing",
                e.to_string(),
                None,
            );

            tracing::event!(
                tracing::Level::ERROR,
                worker_id = worker_id,
                reason = "deserialize_routes_error"
            );

            return make_result(&err);
        }
    };
    let routes_len = routes.len();

    match app.add_routes(worker_id, routes) {
        Ok(r) => {
            let cnt = r.len();

            tracing::event!(
                tracing::Level::DEBUG,
                worker_id = worker_id,
                count = cnt as u64,
                "routes added"
            );

            make_result(&r)
        }
        Err(e) => {
            tracing::event!(tracing::Level::ERROR, worker_id=worker_id, code=?e.code, count=routes_len, "add_routes error");

            make_result(&FfiError::from(e))
        }
    }
}

/// Finds a route that matches the given method and path from a serialized JSON request.
///
/// # Safety
/// - The `handle` pointer must be a valid pointer returned by `init`.
/// - The `request_json` pointer must point to a valid, null-terminated C string.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(app_id=app_id))]
pub unsafe extern "C" fn handle_request(
    app_id: AppId,
    worker_id: WorkerId,
    request_key: RequestKey,
    payload_ptr: ReadonlyPointer,
    cb: HandleRequestCallback,
) {
    let app = match get_app(app_id, "handle_request") {
        Ok(a) => a,
        Err(e) => {
            (cb)(request_key, 0, make_result(&e));

            return;
        }
    };
    let payload_str: LenPrefixedString =
        match unsafe { take_len_prefixed_pointer(payload_ptr, ZERO_COPY_THRESHOLD as usize) } {
            Ok(p) => p,
            Err(e) => {
                let err = FfiError::new(
                    FfiErrorCode::InvalidArgument,
                    "ffi",
                    "handle_request",
                    "validation",
                    e.to_string(),
                    Some(serde_json::json!({"payload_ptr": format!("{:p}", payload_ptr)})),
                );

                (cb)(request_key, 0, make_result(&err));

                return;
            }
        };

    app.handle_request(worker_id, cb, request_key, payload_str);
}

/// Seals the router, optimizing it for fast lookups. No routes can be added after sealing.
///
/// # Safety
/// The `handle` pointer must be a valid pointer returned by `init`.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(app_id=app_id))]
pub unsafe extern "C" fn seal_routes(app_id: AppId) -> MutablePointer {
    let app = match get_app(app_id, "seal_routes") {
        Ok(a) => a,
        Err(e) => return make_result(&e),
    };

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
#[tracing::instrument(skip_all, fields(app_id=app_id))]
pub unsafe extern "C" fn free(app_id: AppId, ptr: MutablePointer) {
    if find_app(app_id).is_none() {
        return;
    }

    unsafe { pointer_registry::free(ptr) };
}

/// Runs the callback dispatch loop on the current thread.
///
/// This function blocks and processes enqueued callback jobs. Use it from
/// a JS Worker thread if you need callbacks to execute in that Worker's
/// context without periodic polling.
///
/// # Safety
/// This function does not take ownership of any external resources. It will
/// block the calling thread until the process exits or the underlying channel
/// is closed.
#[unsafe(no_mangle)]
#[tracing::instrument(skip_all, fields(app_id=app_id, worker_id=worker_id))]
pub unsafe extern "C" fn run_dispatch_loop(app_id: AppId, worker_id: WorkerId) {
    let app = match find_app(app_id) {
        Some(p) => unsafe { &*p },
        None => return,
    };

    app.dispatcher().run_foreground_loop(worker_id);
}

fn get_app<'a>(app_id: AppId, stage: StaticString) -> Result<&'a App, Box<FfiError>> {
    match find_app(app_id) {
        Some(p) => Ok(unsafe { &*p }),
        None => {
            let err = FfiError::new(
                FfiErrorCode::AppNotFound,
                "ffi",
                stage,
                "validation",
                "App not found. please check if the app is constructed".to_string(),
                Some(serde_json::json!(null)),
            );

            Err(Box::new(err))
        }
    }
}

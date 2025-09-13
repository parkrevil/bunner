use crossbeam_channel as xchan;
use std::ffi::{CString, c_void};
use std::os::raw::c_char;
use std::sync::OnceLock;

use super::HandleRequestCallback;
use crate::utils::string;

struct CallbackJob {
    callback: HandleRequestCallback,
    request_id: Option<String>,
    route_key: Option<u16>,
    result_ptr: *mut c_char,
    owned_ptr: Option<*mut c_void>,
    cleanup: Option<unsafe fn(*mut c_void)>,
}

// It is safe to send CallbackJob across threads because:
// - `cb` is a function pointer (Send + Sync)
// - `req_id` is owned String
// - `res_ptr` points to heap memory allocated in Rust and will be freed by the callback; ownership is transferred to the dispatcher thread.
unsafe impl Send for CallbackJob {}

static TX: OnceLock<xchan::Sender<CallbackJob>> = OnceLock::new();
static RX: OnceLock<xchan::Receiver<CallbackJob>> = OnceLock::new();

const CALLBACK_CHANNEL_CAPACITY: usize = 1024;

fn init() -> xchan::Sender<CallbackJob> {
    let (tx, rx) = xchan::bounded::<CallbackJob>(CALLBACK_CHANNEL_CAPACITY);
    let _ = RX.set(rx);

    std::thread::Builder::new()
        .name("bunner-callback-dispatcher".to_string())
        .spawn(|| {
            while let Ok(job) = RX.get().unwrap().recv() {
                tracing::event!(
                    tracing::Level::TRACE,
                    stage = "dispatcher_recv",
                    has_req_id = job.request_id.is_some(),
                    route_key = job.route_key
                );

                // Create a temporary C string for req_id valid only during the call
                let request_id_cstr: Option<CString> = job
                    .request_id
                    .as_ref()
                    .and_then(|s| CString::new(s.as_str()).ok());
                let request_id_ptr = request_id_cstr
                    .as_ref()
                    .map(|s| s.as_ptr())
                    .unwrap_or(std::ptr::null());

                // SAFETY: res_ptr is expected to be a valid pointer allocated by Rust.
                // The callback should free it; however, if the callback panics, we catch and free here.
                let res = std::panic::catch_unwind(|| {
                    (job.callback)(
                        request_id_ptr,
                        job.route_key.unwrap_or_default(),
                        job.result_ptr,
                    )
                });

                if res.is_err() {
                    // Callback panicked: ensure we free the buffer to avoid leaks.
                    unsafe { string::free_string(job.result_ptr) };

                    tracing::event!(tracing::Level::ERROR, reason = "callback_panic_caught");
                }

                tracing::event!(
                    tracing::Level::TRACE,
                    stage = "dispatcher_done",
                    cleaned = job.owned_ptr.is_some()
                );

                if let (Some(optr), Some(clean)) = (job.owned_ptr, job.cleanup) {
                    unsafe { clean(optr) };
                }
            }
        })
        .ok();
    tx
}

pub fn enqueue(
    callback: HandleRequestCallback,
    request_id: Option<&str>,
    route_key: Option<u16>,
    res_ptr: *mut c_char,
) {
    let tx = TX.get_or_init(init);

    tracing::event!(
        tracing::Level::TRACE,
        stage = "dispatcher_enqueue",
        has_req_id = request_id.is_some(),
        route_key = route_key
    );

    let send_result = tx.send(CallbackJob {
        callback,
        request_id: request_id.map(|s| s.to_string()),
        route_key,
        result_ptr: res_ptr,
        owned_ptr: None,
        cleanup: None,
    });

    if let Err(e) = send_result {
        tracing::error!(
            "Failed to enqueue callback job. Channel may be full or disconnected. Error: {:?}",
            e
        );
        // If sending fails, we must free the result pointer to prevent a memory leak,
        // as the dispatcher thread will never receive it.
        unsafe { string::free_string(res_ptr) };
    }
}

use crossbeam_channel as xchan;
use std::ffi::{c_void, CStr, CString};
use std::os::raw::c_char;
use std::sync::OnceLock;

use super::HandleRequestCallback;
// pointer_registry::free removed; callers free CString directly

struct CallbackJob {
    callback: HandleRequestCallback,
    request_id: Option<*mut c_char>,
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

                // request_id is provided as a raw pointer; ownership already transferred by caller/helper.
                let request_id_ptr: *mut c_char = job.request_id.unwrap_or(std::ptr::null_mut());

                let request_id_len: u8 = if request_id_ptr.is_null() {
                    0u8
                } else {
                    unsafe {
                        CStr::from_ptr(request_id_ptr as *const c_char)
                            .to_bytes()
                            .len() as u8
                    }
                };

                // SAFETY: res_ptr is expected to be a valid pointer allocated by Rust.
                // The callback should free it; however, if the callback panics, we catch and free here.
                let result_len: u32 = if job.result_ptr.is_null() {
                    0u32
                } else {
                    unsafe { CStr::from_ptr(job.result_ptr).to_bytes().len() as u32 }
                };

                let res = std::panic::catch_unwind(|| {
                    (job.callback)(
                        request_id_ptr as *const c_char,
                        request_id_len,
                        job.route_key.unwrap_or_default(),
                        job.result_ptr,
                        result_len,
                    )
                });

                if res.is_err() {
                    // Callback panicked: reclaim and free any ownership that was transferred
                    if !request_id_ptr.is_null() {
                        // Reclaim and drop CString to free allocation
                        unsafe { let _ = CString::from_raw(request_id_ptr); };
                    }
                    if !job.result_ptr.is_null() {
                        // Reclaim and drop CString to free allocation
                        unsafe { let _ = CString::from_raw(job.result_ptr); };
                    }

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
    request_id: Option<*mut c_char>,
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
        request_id,
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
        // Free both pointers as enqueue failed; request_id may be a raw ptr transferred by caller
        if let Some(rptr) = request_id {
            unsafe { let _ = CString::from_raw(rptr); };
        }

        unsafe { let _ = CString::from_raw(res_ptr); };
    }
}

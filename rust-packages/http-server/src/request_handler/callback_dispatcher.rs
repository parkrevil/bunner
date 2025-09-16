use crossbeam_channel as xchan;
use std::ffi::{c_void, CString};
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

                let request_id_ptr: *mut c_char = job.request_id.unwrap_or(std::ptr::null_mut());
                let res = std::panic::catch_unwind(|| {
                    (job.callback)(
                        request_id_ptr as *const c_char,
                        job.route_key.unwrap_or_default(),
                        job.result_ptr,
                    )
                });

                if res.is_err() {
                    if !request_id_ptr.is_null() {
                        unsafe {
                            let _ = CString::from_raw(request_id_ptr);
                        };
                    }

                    if !job.result_ptr.is_null() {
                        unsafe { crate::pointer_registry::free(job.result_ptr as *mut u8) };
                    }

                    tracing::event!(tracing::Level::ERROR, reason = "callback_panic_caught");
                } else if !request_id_ptr.is_null() {
                    unsafe {
                        let _ = CString::from_raw(request_id_ptr);
                    }
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

        if let Some(rptr) = request_id {
            unsafe {
                let _ = CString::from_raw(rptr);
            };
        }

        if !res_ptr.is_null() {
            unsafe { crate::pointer_registry::free(res_ptr as *mut u8) };
        }
    }
}

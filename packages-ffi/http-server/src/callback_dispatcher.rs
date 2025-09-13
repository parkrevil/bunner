use crossbeam_channel as xchan;
use std::ffi::{c_void, CString};
use std::os::raw::c_char;
use std::sync::OnceLock;

type FfiCallback = extern "C" fn(*const c_char, u16, *mut c_char);

struct CallbackJob {
    cb: FfiCallback,
    req_id: Option<String>,
    route_key: u16,
    res_ptr: *mut c_char,
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

fn init() -> xchan::Sender<CallbackJob> {
    let (tx, rx) = xchan::unbounded::<CallbackJob>();
    let _ = RX.set(rx);
    std::thread::Builder::new()
        .name("bunner-callback-dispatcher".to_string())
        .spawn(|| loop {
            match RX.get().unwrap().recv() {
                Ok(job) => {
                    tracing::event!(
                        tracing::Level::TRACE,
                        stage = "dispatcher_recv",
                        has_req_id = job.req_id.is_some(),
                        route_key = job.route_key as u64
                    );
                    // Create a temporary C string for req_id valid only during the call
                    let req_id_c: Option<CString> = job
                        .req_id
                        .as_ref()
                        .and_then(|s| CString::new(s.as_str()).ok());
                    let req_id_ptr = req_id_c
                        .as_ref()
                        .map(|s| s.as_ptr())
                        .unwrap_or(std::ptr::null());

                    // SAFETY: res_ptr is expected to be a valid pointer allocated by Rust.
                    // The callback should free it; however, if the callback panics, we catch and free here.
                    let res = std::panic::catch_unwind(|| {
                        (job.cb)(req_id_ptr, job.route_key, job.res_ptr)
                    });
                    if res.is_err() {
                        // Callback panicked: ensure we free the buffer to avoid leaks.
                        unsafe { crate::free_string(job.res_ptr) };
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
                    // Drop req_id_c here so its memory isn't leaked; res_ptr must be freed by callback.
                }
                Err(_) => break,
            }
        })
        .ok();
    tx
}

pub fn enqueue(cb: FfiCallback, req_id: Option<&str>, route_key: u16, res_ptr: *mut c_char) {
    let tx = TX.get_or_init(init);
    tracing::event!(
        tracing::Level::TRACE,
        stage = "dispatcher_enqueue",
        has_req_id = req_id.is_some(),
        route_key = route_key as u64
    );
    let _ = tx.send(CallbackJob {
        cb,
        req_id: req_id.map(|s| s.to_owned()),
        route_key,
        res_ptr,
        owned_ptr: None,
        cleanup: None,
    });
}

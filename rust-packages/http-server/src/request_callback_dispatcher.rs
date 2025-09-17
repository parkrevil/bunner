use crossbeam_channel as xchan;
use std::sync::OnceLock;

use super::HandleRequestCallback;

struct CallbackJob {
    callback: HandleRequestCallback,
    request_id: Option<*mut u8>,
    route_key: Option<u16>,
    result_ptr: *mut u8,
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

                let request_id_ptr: *mut u8 = job.request_id.unwrap_or(std::ptr::null_mut());
                let res = std::panic::catch_unwind(|| {
                    (job.callback)(
                        request_id_ptr,
                        job.route_key.unwrap_or_default(),
                        job.result_ptr,
                    )
                });

                if res.is_err() {
                    tracing::event!(tracing::Level::ERROR, reason = "callback_panic_caught");
                }

                tracing::event!(tracing::Level::TRACE, stage = "dispatcher_done");
            }
        })
        .ok();
    tx
}

/// # Safety
///
/// This function is unsafe because it dereferences raw pointers passed from FFI.
/// The caller must ensure that the `callback`, `request_id`, and `res_ptr`
/// are valid and point to memory that is safe to access.
pub unsafe fn enqueue(
    callback: HandleRequestCallback,
    request_id: Option<*mut u8>,
    route_key: Option<u16>,
    res_ptr: *mut u8,
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
    });

    if let Err(e) = send_result {
        tracing::error!(
            "Failed to enqueue callback job. Channel may be full or disconnected. Error: {:?}",
            e
        );

        if let Some(rptr) = request_id {
            unsafe { crate::pointer_registry::free(rptr) };
        }

        if !res_ptr.is_null() {
            unsafe { crate::pointer_registry::free(res_ptr) };
        }
    }
}

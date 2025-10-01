use crossbeam_channel as xchan;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::pointer_registry::free;
use crate::types::{MutablePointer, RequestKey, WorkerId};

use super::HandleRequestCallback;

struct CallbackJob {
    callback: HandleRequestCallback,
    request_key: RequestKey,
    result_ptr: MutablePointer,
}

struct WorkerQueue {
    tx: xchan::Sender<CallbackJob>,
    rx: xchan::Receiver<CallbackJob>,
}

pub struct AppRequestCallbackDispatcher {
    workers: Mutex<HashMap<WorkerId, WorkerQueue>>,
}

impl AppRequestCallbackDispatcher {
    pub fn new() -> Self {
        Self {
            workers: Mutex::new(HashMap::new()),
        }
    }

    fn get_or_create(&self, worker_id: WorkerId) -> WorkerQueue {
        let mut guard = self.workers.lock().unwrap();
        if let Some(wq) = guard.get(&worker_id) {
            return WorkerQueue {
                tx: wq.tx.clone(),
                rx: wq.rx.clone(),
            };
        }
        let (tx, rx) = xchan::unbounded::<CallbackJob>();
        let wq = WorkerQueue {
            tx: tx.clone(),
            rx: rx.clone(),
        };
        guard.insert(worker_id, wq);
        WorkerQueue { tx, rx }
    }

    /// Enqueue a job for a specific worker.
    /// # Safety
    /// Caller must ensure pointers are valid.
    pub unsafe fn enqueue(
        &self,
        worker_id: WorkerId,
        callback: HandleRequestCallback,
        request_key: RequestKey,
        result_ptr: MutablePointer,
    ) {
        let wq = self.get_or_create(worker_id);
        let send_result = wq.tx.send(CallbackJob {
            callback,
            request_key,
            result_ptr,
        });
        if let Err(e) = send_result {
            tracing::error!("Failed to enqueue app-scoped callback job: {:?}", e);
            if !result_ptr.is_null() {
                unsafe { free(result_ptr) };
            }
        }
    }

    /// Run a foreground loop for a specific worker, consuming only that worker's queue.
    pub fn dispatch_callback(&self, worker_id: WorkerId) {
        let rx = { self.get_or_create(worker_id).rx };
        let mut remaining = rx.len();

        while remaining > 0 {
            let job = match rx.try_recv() {
                Ok(j) => j,
                Err(_e) => break,
            };

            remaining -= 1;

            tracing::event!(
                tracing::Level::TRACE,
                stage = "dispatcher_recv_fg_app",
                request_key = job.request_key
            );

            let res = std::panic::catch_unwind(|| (job.callback)(job.request_key, job.result_ptr));

            if res.is_err() {
                tracing::event!(tracing::Level::ERROR, reason = "callback_panic_caught");
            }

            tracing::event!(tracing::Level::TRACE, stage = "dispatcher_done_fg_app");
        }
    }
}

impl Default for AppRequestCallbackDispatcher {
    fn default() -> Self {
        Self::new()
    }
}

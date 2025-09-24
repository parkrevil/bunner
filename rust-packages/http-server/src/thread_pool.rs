use crossbeam_channel as xchan;
use std::sync::OnceLock;
use std::thread;
use std::thread::JoinHandle;

type Job = Box<dyn FnOnce() + Send + 'static>;

pub(crate) enum Task {
    Job(Job),
    Shutdown,
}

static TASK_SENDER: OnceLock<xchan::Sender<Task>> = OnceLock::new();
static TASK_RECEIVER: OnceLock<xchan::Receiver<Task>> = OnceLock::new();
static WORKER_COUNT: OnceLock<usize> = OnceLock::new();
static WORKER_HANDLES: OnceLock<std::sync::Mutex<Vec<JoinHandle<()>>>> = OnceLock::new();
static DESIRED_WORKERS: OnceLock<usize> = OnceLock::new();
static DESIRED_CAPACITY: OnceLock<usize> = OnceLock::new();

fn init() -> xchan::Sender<Task> {
    let default_workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let workers = DESIRED_WORKERS
        .get()
        .copied()
        .unwrap_or(default_workers.clamp(1, 256));
    let capacity = DESIRED_CAPACITY
        .get()
        .copied()
        .unwrap_or(512usize.clamp(1, 65_536));

    let (tx, rx) = xchan::bounded::<Task>(capacity);
    let _ = TASK_RECEIVER.set(rx);

    tracing::event!(
        tracing::Level::INFO,
        workers = workers as u64,
        capacity = capacity as u64,
        "thread_pool init"
    );

    if WORKER_COUNT.get().is_none() {
        let _ = WORKER_COUNT.set(workers);
        let handles_vec =
            WORKER_HANDLES.get_or_init(|| std::sync::Mutex::new(Vec::with_capacity(workers)));
        for _ in 0..workers {
            let rx = TASK_RECEIVER.get().unwrap().clone();
            if let Ok(handle) = thread::Builder::new()
                .name("bunner-http-worker".to_string())
                .spawn(move || {
                    loop {
                        match rx.recv() {
                            Ok(Task::Job(job)) => {
                                let res =
                                    std::panic::catch_unwind(std::panic::AssertUnwindSafe(job));
                                if res.is_err() {
                                    tracing::event!(tracing::Level::ERROR, reason = "job_panic");
                                }
                            }
                            Ok(Task::Shutdown) => break,
                            Err(_) => break,
                        }
                    }
                })
            {
                let _ = handles_vec.lock().map(|mut v| v.push(handle));
            }
        }
    }

    tx
}

/// Configure the thread pool sizing before first use.
/// Safe to call multiple times; the first call wins.
pub fn configure_thread_pool(workers: u16, capacity: u32) {
    let _ = DESIRED_WORKERS.set((workers as usize).clamp(1, 256));
    let _ = DESIRED_CAPACITY.set((capacity as usize).clamp(1, 65_536));
}

#[tracing::instrument(level = "trace", skip(job))]
pub fn submit_job(job: Job) -> Result<(), xchan::TrySendError<Task>> {
    let tx = TASK_SENDER.get_or_init(init);
    match tx.try_send(Task::Job(job)) {
        Ok(()) => Ok(()),
        Err(e) => {
            match &e {
                xchan::TrySendError::Full(_) => {
                    tracing::event!(tracing::Level::TRACE, reason = "full")
                }
                xchan::TrySendError::Disconnected(_) => {
                    tracing::event!(tracing::Level::TRACE, reason = "disconnected")
                }
            }
            Err(e)
        }
    }
}

pub fn shutdown_pool() {
    if let (Some(&workers), Some(tx)) = (WORKER_COUNT.get(), TASK_SENDER.get()) {
        tracing::event!(
            tracing::Level::INFO,
            workers = workers as u64,
            "thread_pool shutdown"
        );
        for _ in 0..workers {
            // ignore error if already disconnected
            let _ = tx.send(Task::Shutdown);
        }
        if let Some(handles_mutex) = WORKER_HANDLES.get()
            && let Ok(mut handles) = handles_mutex.lock()
        {
            for h in handles.drain(..) {
                let _ = h.join();
            }
        }
    }
}

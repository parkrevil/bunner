use crossbeam_channel as xchan;
use std::sync::{
    OnceLock,
    atomic::{AtomicBool, Ordering},
};
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
static JUST_SHUTDOWN: AtomicBool = AtomicBool::new(false);
static WORKER_HANDLES: OnceLock<std::sync::Mutex<Vec<JoinHandle<()>>>> = OnceLock::new();
#[cfg(feature = "test")]
static FORCE_QUEUE_FULL: AtomicBool = AtomicBool::new(false);

fn env_usize(key: &str, default: usize, min: usize, max: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .map(|v| v.clamp(min, max))
        .unwrap_or(default)
}

fn init() -> xchan::Sender<Task> {
    let default_workers = thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    let workers = env_usize("BUNNER_HTTP_WORKERS", default_workers, 1, 256);
    let capacity = env_usize("BUNNER_HTTP_QUEUE_CAP", 512, 1, 65_536);

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

#[tracing::instrument(level = "trace", skip(job))]
pub fn submit_job(job: Job) -> Result<(), xchan::TrySendError<Task>> {
    #[cfg(feature = "test")]
    if FORCE_QUEUE_FULL.load(Ordering::SeqCst) {
        return Err(xchan::TrySendError::Full(Task::Job(job)));
    }

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
        JUST_SHUTDOWN.store(true, Ordering::SeqCst);
        tracing::event!(
            tracing::Level::INFO,
            workers = workers as u64,
            "thread_pool shutdown"
        );
        for _ in 0..workers {
            // ignore error if already disconnected
            let _ = tx.send(Task::Shutdown);
        }
        if let Some(handles_mutex) = WORKER_HANDLES.get() {
            if let Ok(mut handles) = handles_mutex.lock() {
                for h in handles.drain(..) {
                    let _ = h.join();
                }
            }
        }
    }
}

#[cfg(feature = "test")]
pub(crate) fn set_force_full(value: bool) {
    FORCE_QUEUE_FULL.store(value, Ordering::SeqCst);
}

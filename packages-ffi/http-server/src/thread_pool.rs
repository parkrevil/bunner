use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex, OnceLock,
};
use std::thread;

type Job = Box<dyn FnOnce() + Send + 'static>;

pub(crate) enum Task {
    Job(Job),
    Shutdown,
}

static TASK_SENDER: OnceLock<Mutex<Option<mpsc::SyncSender<Task>>>> = OnceLock::new();
static WORKER_COUNT: OnceLock<usize> = OnceLock::new();
static JUST_SHUTDOWN: AtomicBool = AtomicBool::new(false);
#[cfg(feature = "test")]
static FORCE_QUEUE_FULL: AtomicBool = AtomicBool::new(false);

fn init() -> mpsc::SyncSender<Task> {
    let workers = std::cmp::max(
        32,
        thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4),
    );
    let capacity = 512; // project convention: fixed capacity
    let (tx, rx) = mpsc::sync_channel::<Task>(capacity);
    let rx = Arc::new(Mutex::new(rx));
    for _ in 0..workers {
        let rx_cloned = Arc::clone(&rx);
        thread::spawn(move || loop {
            let msg = {
                let guard = rx_cloned.lock().unwrap();
                guard.recv()
            };
            match msg {
                Ok(Task::Job(job)) => job(),
                Ok(Task::Shutdown) => break,
                Err(_) => break,
            }
        });
    }
    let _ = WORKER_COUNT.set(workers);
    tx
}

pub fn submit_job(job: Job) -> Result<(), mpsc::TrySendError<Task>> {
    #[cfg(feature = "test")]
    if FORCE_QUEUE_FULL.load(Ordering::SeqCst) {
        return Err(mpsc::TrySendError::Full(Task::Job(job)));
    }
    let lock = TASK_SENDER.get_or_init(|| Mutex::new(Some(init())));
    let mut guard = lock.lock().unwrap();
    if guard.is_none() {
        // Immediately after shutdown, reject the first subsequent submission
        if JUST_SHUTDOWN.swap(false, Ordering::SeqCst) {
            return Err(mpsc::TrySendError::Disconnected(Task::Job(job)));
        }
        *guard = Some(init());
    }
    let tx = guard.as_ref().unwrap();
    tx.try_send(Task::Job(job))
}

#[cfg(feature = "test")]
pub fn shutdown_pool() {
    if let (Some(lock), Some(&workers)) = (TASK_SENDER.get(), WORKER_COUNT.get()) {
        JUST_SHUTDOWN.store(true, Ordering::SeqCst);
        let mut opt = lock.lock().unwrap();
        if let Some(tx) = opt.take() {
            for _ in 0..workers {
                // Block to ensure delivery even if queue is saturated
                let _ = tx.send(Task::Shutdown);
            }
            // drop tx here so channel disconnects once workers exit
        }
    }
}

#[cfg(feature = "test")]
pub(crate) fn set_force_full(value: bool) {
    FORCE_QUEUE_FULL.store(value, Ordering::SeqCst);
}
